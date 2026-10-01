var params = JSON.parse(value),
	result = {};

function isSet(macro_value) {
	return typeof macro_value === 'string' && macro_value !== '' && macro_value.indexOf('{$') !== 0;
}

function getHeader(headers, name) {
	for (var key in headers) {
		if (key.toLowerCase() === name) {
			return Array.isArray(headers[key]) ? headers[key][0] : headers[key];
		}
	}

	return null;
}

function request(url, headers) {
	var req = new HttpRequest(),
		body;

	req.addHeader('User-Agent: Zabbix ChangeLog monitor');

	for (var i = 0; i < headers.length; i++) {
		req.addHeader(headers[i]);
	}

	if (isSet(params.proxy)) {
		req.setProxy(params.proxy);
	}

	body = req.get(url);

	return {status: req.getStatus(), body: body, headers: req.getHeaders()};
}

// Latest commit that touched the ChangeLog.
var api_headers = ['Accept: application/vnd.github+json', 'X-GitHub-Api-Version: 2022-11-28'];

if (isSet(params.token)) {
	api_headers.push('Authorization: Bearer ' + params.token);
}

var commits = request('https://api.github.com/repos/' + params.repo + '/commits?per_page=1'
	+ '&sha=' + encodeURIComponent(params.branch) + '&path=' + encodeURIComponent(params.path), api_headers);

if (commits.status !== 200) {
	var error = '';

	try {
		error = JSON.parse(commits.body).message;
	}
	catch (e) {
		error = commits.body.substring(0, 200);
	}

	throw 'GitHub API returned HTTP ' + commits.status + ': ' + error;
}

var list = JSON.parse(commits.body);

if (!Array.isArray(list) || list.length === 0) {
	throw 'No commits found for "' + params.path + '" in ' + params.repo + '@' + params.branch + '.';
}

var commit = list[0];

result.sha = commit.sha;
result.short_sha = commit.sha.substring(0, 12);
result.date = Math.floor(Date.parse(commit.commit.committer.date) / 1000);
result.author = commit.commit.author.name;
result.message = commit.commit.message.split('\n')[0];
result.url = commit.html_url;
result.rate_limit_remaining = parseInt(getHeader(commits.headers, 'x-ratelimit-remaining'), 10);
result.rate_limit_limit = parseInt(getHeader(commits.headers, 'x-ratelimit-limit'), 10);

// Beginning of the ChangeLog at that commit: only the latest section is needed, so a byte range is requested.
var raw = request('https://raw.githubusercontent.com/' + params.repo + '/' + commit.sha + '/' + params.path,
	['Range: bytes=0-' + (parseInt(params.bytes, 10) - 1)]);

if (raw.status !== 200 && raw.status !== 206) {
	throw 'Cannot read ' + params.path + ': HTTP ' + raw.status + '.';
}

var lines = raw.body.split('\n'),
	section = [],
	in_section = false,
	block = '';

result.version = '';
result.features = 0;
result.fixes = 0;

for (var i = 0; i < lines.length; i++) {
	var line = lines[i].replace(/\r$/, ''),
		header = line.match(/^Changes for (.+)$/);

	if (header !== null) {
		if (in_section) {
			break;
		}

		in_section = true;
		result.version = header[1].trim();
		continue;
	}

	if (!in_section) {
		continue;
	}

	if (/^New features:/.test(line)) {
		block = 'features';
	}
	else if (/^Bug fixes:/.test(line)) {
		block = 'fixes';
	}
	else if (/^[A-Z.]{10} \[/.test(line)) {
		result[block === 'fixes' ? 'fixes' : 'features']++;
	}

	section.push(line);
}

if (result.version === '') {
	throw 'Cannot find a "Changes for" section in the first ' + params.bytes + ' bytes of ' + params.path + '.';
}

result.entries = result.features + result.fixes;
result.section = section.join('\n').trim().substring(0, 60000);

return JSON.stringify(result);
