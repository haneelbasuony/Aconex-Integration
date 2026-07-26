const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");


const appPath = process.cwd();


console.log("==============================");
console.log(" ACONEX Document Sync Launcher");
console.log("==============================");


function checkNode() {

    try {

        const nodePath = execSync(
            "where node",
            {
                encoding: "utf8",
                shell: "cmd.exe"
            }
        ).trim().split("\n")[0];


        const version = execSync(
            `"${nodePath}" --version`,
            {
                encoding: "utf8",
                shell: "cmd.exe"
            }
        );


        console.log(
            `Node.js detected: ${version.trim()}`
        );


        return nodePath;

    }
    catch(err) {

        console.error(
            "Node.js is not installed."
        );

        console.error(err.message);

        pause();
        process.exit(1);
    }
}



function installPackages() {

    const nodeModules = path.join(
        appPath,
        "node_modules"
    );


    if (!fs.existsSync(nodeModules)) {

        console.log("\nInstalling packages...\n");


       execSync(
    "npm install",
    {
        cwd: appPath,
        stdio:"inherit",
        shell:"cmd.exe"
    }
);

    }
    else {

        console.log("Packages already installed.");

    }
}



function startApplication(nodePath){

    console.log("\nStarting ACONEX Sync...\n");


  const child = spawn(
    nodePath,
    [
        path.join(appPath, "index.js")
    ],
    {
        cwd: appPath,
        stdio: "inherit",
        shell: false
    }
);


    child.on(
        "close",
        code => {

            console.log(
                `Application closed with code ${code}`
            );

            pause();

        }
    );
}



function pause(){

    console.log("\nPress ENTER to close...");
    process.stdin.resume();
    process.stdin.once(
        "data",
        ()=>{
            process.exit();
        }
    );
}



const nodePath = checkNode();

installPackages();

startApplication(nodePath);