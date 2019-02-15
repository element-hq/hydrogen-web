const finalhandler = require('finalhandler')
const http = require('http')
const serveStatic = require('serve-static')
const path = require('path');

// Serve up parent directory with cache disabled
const serve = serveStatic(
	path.resolve(__dirname, "../"),
	{
		etag: false,
		setHeaders: res => {
			res.setHeader("Pragma", "no-cache");
			res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
			res.setHeader("Expires", "Wed, 21 Oct 2015 07:28:00 GMT");
		},
		index: ['index.html', 'index.htm']
	}
);
 
// Create server
const server = http.createServer(function onRequest (req, res) {
	serve(req, res, finalhandler(req, res))
});

// Listen
server.listen(3000);