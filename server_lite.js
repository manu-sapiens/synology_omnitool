/**
 * Copyright (c) 2023 MERCENARIES.AI PTE. LTD.
 * All rights reserved.
 */
//@ts-check
const VERSION = '0.6.0.lite.016.e';

const express = require('express');
const http = require('http');
const session = require('express-session');
const axios = require('axios');
const { spawn } = require('child_process');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();

const OMNITOOL_INSTALL_SCRIPT = './omnitool_init.sh'; // './omnitool_start.sh';
const CONTAINER_HOST = '127.0.0.1';
const OMNI_URL = 'http://127.0.0.1:1688'; // URL of the OMNITOOL service
const PROXY_PORT_OMNITOOL = 4444;
const CONTAINER_PORT_OMNITOOL = 1688;


const DELAY_OMNITOOL_SET_TO_RUNNING = 2000; // 2 seconds
const CHECK_OMNI_INTERVAL = 60000; // 1 minute
const MAX_LOG_SIZE = 1000; // Set your desired maximum log size

// Global variable
global.OMNITOOL_RUNNING = false;
global.OMNITOOL_READY = false;
global.ALREADY_STARTING = false;
global.LOCAL_URL = "";
global.PING_URL = "";
global.PROTOCOL = "";
global.PROXY_STARTED = false;
global.logs = [];
global.error_logs = [];
global.OMNITOOL_PROXY = null;
global.CONNECTED_TO_MASTER = false;

console.log(`************ Omnitool Proxy Server v${VERSION} ************`);
    
            
async function startOmnitoolServer()
{
    if (global.ALREADY_STARTING) return;
    global.ALREADY_STARTING = true;

    console.log('Starting Omnitool Server...');
    return new Promise((resolve, reject) =>
    {
        const omnitoolStartProcess = spawn(OMNITOOL_INSTALL_SCRIPT);
        omnitoolStartProcess.stdout.on('data', (data) =>
        {
            if (global.logs.length >= MAX_LOG_SIZE) {
                global.logs.shift(); // Remove the oldest log entry
            }
            global.logs.push(data.toString());
            console.log(`[log] ${data}`);
        
            if (!global.OMNITOOL_RUNNING)
            {
                if (data.toString().includes(`Server has started and is ready to accept connections`))
                {
                    console.log('Omnitool server started successfully');
                    setOmnitoolRunning(true);
                }
            }
        });

        omnitoolStartProcess.stderr.on('data', (data) =>
        {
            if (global.error_logs.length >= MAX_LOG_SIZE) {
                global.error_logs.shift(); // Remove the oldest log entry
            }

            console.error(`[stderr] ${data}`);
            global.error_logs.push(data.toString());
        });

        omnitoolStartProcess.on('close', (code) =>
        {
            const message = `Omnitool server process exited with code: ${code}`;
            console.log(message);
            global.logs.push(message);

            global.ALREADY_STARTING = false;
            if (code === 0)
            {
                //@ts-ignore
                resolve();
            } else
            {
                reject(`Omnitool server did not start properly.`);
            }
        });
    });
}

function setOmnitoolRunning(set_running)
{
    if (set_running === true)
    {
        if (global.OMNITOOL_READY === false) 
        {
            global.OMNITOOL_READY = true;
            console.log('Omnitool server is READY! ');
            setTimeout(() =>
            {
                console.log('Omnitool server is RUNNING! ');
                global.OMNITOOL_RUNNING = true;
            }, DELAY_OMNITOOL_SET_TO_RUNNING); // Delay by 2 second

            // start mirroring to /data when the server is running
            // startMirrorToDataDir(); #DISABLED!

        }

    }
    else
    {
        global.OMNITOOL_READY = false;
        global.OMNITOOL_RUNNING = false;
    }
}

// Function to check the status of the external service
async function checkOmnitoolStatus()
{
    try
    {
        //@ts-ignore
        const response = await axios.get('http://127.0.0.1:1688/api/v1/mercenaries/ping');
        if (response.data && response.data.ping === 'pong' && Object.keys(response.data.payload).length === 0)
        {
            setOmnitoolRunning(true);
        }
        else
        {
            setOmnitoolRunning(false);
        }
    } catch (error)
    {
        setOmnitoolRunning(false);
    }
}

async function handleGetStartOmnitoolServer(req, res)
{
    console.log(`Omnitool Server:ALREADY_STARTING =  ${global.ALREADY_STARTING}`);
    if (global.ALREADY_STARTING) 
    {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end("Omnitool server already starting");
        return;
    }
    try
    {
        await startOmnitoolServer();
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end("Omnitool server started successfully");
    }
    catch (error)
    {
        console.error(error);
        global.ALREADY_STARTING = false;
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end(`Error starting Omnitool server: ${error}`);
    }
}

async function handleGetOmnitoolLogs(req, res)
{
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const reply = { logs: global.logs, error_logs: global.error_logs, ready: global.OMNITOOL_READY };
    res.end(JSON.stringify(reply));
    return;
}

async function handleGetBurstIframe(req, res)
{
    req.session.isVisited = true;

    const reply = { burst_iframe: true };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(reply));

    return;
}

async function proxyRequest(req, res)
{

    console.log('Proxying request');
    if (global.PROXY_STARTED) return;
    global.PROXY_STARTED = true;

    // Proxy logic...
    const options = { hostname: CONTAINER_HOST, port: CONTAINER_PORT_OMNITOOL, path: req.url, method: req.method, headers: req.headers, };
    const proxy = http.request(options, (proxyRes) =>
    {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });
    req.pipe(proxy, { end: true });
    return;
}

async function handleGetRoot(req, res)
{
    proxyRequest(req, res);
}

async function startHuggingfaceServer()
{
    // Start server
    http.createServer(app).listen(PROXY_PORT_OMNITOOL, () =>
    {
        console.log(`Server running on port ${PROXY_PORT_OMNITOOL}`);
    });

}

function omnitoolProxyMiddleware(req, res, next)
{
    // Proxy all requests to OMNITOOL when conditions are met
    return createProxyMiddleware({
        target: OMNI_URL,
        changeOrigin: true,
        ws: true // if you need WebSocket support
    })(req, res, next);
}

async function main(app)
{
    // Configure session middleware
    app.use(session({
        secret: 'your-secret-key',
        resave: false,
        saveUninitialized: true
    }));
    try
    {
        await startHuggingfaceServer();
    }
    catch (error)
    {
        console.error(`There was an error starting the server: ${error}`);
        return;
    }


    app.use(omnitoolProxyMiddleware);

    app.get('/favicon.ico', (req, res) => res.status(204));
    app.get('/', (req, res) => handleGetRoot(req, res));
   
}

// Define the proxy middleware outside the function
global.OMNITOOL_PROXY = createProxyMiddleware({
    target: OMNI_URL,
    changeOrigin: true,
    ws: true // if you need WebSocket support
});

function omnitoolProxyMiddleware(req, res, next)
{
        // Use the predefined proxy middleware
    return global.OMNITOOL_PROXY(req, res, next);
}

main(app);


