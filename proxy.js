const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');

const app = express();

const OMNI_URL = 'http://127.0.0.1:1688'; // URL of the OMNITOOL service
const PROXY_PORT_OMNITOOL = 4444;
const OMNITOOL_INSTALL_SCRIPT = './omnitool_init.sh'; // './omnitool_start.sh';

// Define the proxy middleware
const omnitoolProxyMiddleware = createProxyMiddleware({
    target: OMNI_URL,
    changeOrigin: true,
    ws: true // if you need WebSocket support
});


// Use the proxy middleware
app.use(omnitoolProxyMiddleware);

// Start the server on port 4444
app.listen(PROXY_PORT_OMNITOOL, () => {
    console.log(`Server running on port ${PROXY_PORT_OMNITOOL}`);
});
          
async function startOmnitoolServer()
{
    
    console.log('Starting Omnitool Server...');
    return new Promise((resolve, reject) =>
    {
        const omnitoolStartProcess = spawn(OMNITOOL_INSTALL_SCRIPT);
        omnitoolStartProcess.stdout.on('data', (data) =>
        {
            console.log(`[log] ${data}`);    
        });

        omnitoolStartProcess.stderr.on('data', (data) =>
        {
            console.error(`[stderr] ${data}`);
        });

        omnitoolStartProcess.on('close', (code) =>
        {
            const message = `Omnitool server process exited with code: ${code}`;
            console.log(message);
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

async function main(app)
{
    try
    {
        await startOmnitoolServer();
        console.log('Omnitool server started successfully');
    } catch (error)
    {
        console.error(error);
    }
}

main(app);
