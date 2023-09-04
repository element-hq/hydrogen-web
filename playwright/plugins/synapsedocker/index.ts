/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as fse from "fs-extra";

import {dockerCreateNetwork, dockerExec, dockerLogs, dockerRun, dockerStop} from "../docker";
import {request} from "@playwright/test";


// A plugin to add command to start & stop synapses in
// docker with preset templates.

interface SynapseConfig {
    configDir: string;
    registrationSecret: string;
    // Synapse must be configured with its public_baseurl so we have to allocate a port & url at this stage
    baseUrl: string;
    port: number;
    host: string;
}

export interface SynapseInstance extends SynapseConfig {
    synapseId: string;
}

const synapses = new Map<string, SynapseInstance>();

function randB64Bytes(numBytes: number): string {
    return crypto.randomBytes(numBytes).toString("base64").replace(/=*$/, "");
}

async function cfgDirFromTemplate(template: string): Promise<SynapseConfig> {
    const templateDir = path.join(__dirname, "templates", template);

    const stats = await fse.stat(templateDir);
    if (!stats?.isDirectory) {
        throw new Error(`No such template: ${template}`);
    }
    const tempDir = await fse.mkdtemp(path.join(os.tmpdir(), 'synapsedocker-'));

    // copy the contents of the template dir, omitting homeserver.yaml as we'll template that
    console.log(`Copy ${templateDir} -> ${tempDir}`);
    await fse.copy(templateDir, tempDir, { filter: f => path.basename(f) !== 'homeserver.yaml' });

    const registrationSecret = randB64Bytes(16);
    const macaroonSecret = randB64Bytes(16);
    const formSecret = randB64Bytes(16);

    const synapseHost = process.env["SYNAPSE_IP_ADDRESS"]!!;
    const synapsePort = parseInt(process.env["SYNAPSE_PORT"]!, 10);
    const baseUrl = `http://${synapseHost}:${synapsePort}`;


    // now copy homeserver.yaml, applying substitutions
    console.log(`Gen ${path.join(templateDir, "homeserver.yaml")}`);
    let hsYaml = await fse.readFile(path.join(templateDir, "homeserver.yaml"), "utf8");
    hsYaml = hsYaml.replace(/{{REGISTRATION_SECRET}}/g, registrationSecret);
    hsYaml = hsYaml.replace(/{{MACAROON_SECRET_KEY}}/g, macaroonSecret);
    hsYaml = hsYaml.replace(/{{FORM_SECRET}}/g, formSecret);
    hsYaml = hsYaml.replace(/{{PUBLIC_BASEURL}}/g, baseUrl);

    const dexHost = process.env["DEX_IP_ADDRESS"];
    const dexPort = process.env["DEX_PORT"];
    const dexUrl = `http://${dexHost}:${dexPort}/dex`;
    hsYaml = hsYaml.replace(/{{OIDC_ISSUER}}/g, dexUrl);
    await fse.writeFile(path.join(tempDir, "homeserver.yaml"), hsYaml);

    // now generate a signing key (we could use synapse's config generation for
    // this, or we could just do this...)
    // NB. This assumes the homeserver.yaml specifies the key in this location
    const signingKey = randB64Bytes(32);
    console.log(`Gen ${path.join(templateDir, "localhost.signing.key")}`);
    await fse.writeFile(path.join(tempDir, "localhost.signing.key"), `ed25519 x ${signingKey}`);

    return {
        port: synapsePort,
        host: synapseHost,
        baseUrl,
        configDir: tempDir,
        registrationSecret,
    };
}

// Start a synapse instance: the template must be the name of
// one of the templates in the cypress/plugins/synapsedocker/templates
// directory
export async function synapseStart(template: string): Promise<SynapseInstance> {
    const synCfg = await cfgDirFromTemplate(template);
    console.log(`Starting synapse with config dir ${synCfg.configDir}...`);
    await dockerCreateNetwork({ networkName: "hydrogen" });
    const synapseId = await dockerRun({
        image: "matrixdotorg/synapse:develop",
        containerName: `hydrogen-synapse`,
        dockerParams: [
            "--rm",
            "-v", `${synCfg.configDir}:/data`,
            `--ip=${synCfg.host}`,
            /**
             * When using -p flag with --ip, the docker internal port must be used to access from the host
             */
            "-p", `${synCfg.port}:8008/tcp`,
            "--network=hydrogen",
        ],
        applicationParams: [
            "run"
        ]
    });

    console.log(`Started synapse with id ${synapseId} on port ${synCfg.port}.`);

    // Await Synapse healthcheck
    await dockerExec({
        containerId: synapseId,
        params: [
            "curl",
            "--connect-timeout", "30",
            "--retry", "30",
            "--retry-delay", "1",
            "--retry-all-errors",
            "--silent",
            "http://localhost:8008/health",
        ],
    });

    const synapse: SynapseInstance = { synapseId, ...synCfg };
    synapses.set(synapseId, synapse);
    return synapse;
}

export async function synapseStop(id: string): Promise<void> {
    const synCfg = synapses.get(id);

    if (!synCfg) throw new Error("Unknown synapse ID");

    const synapseLogsPath = path.join("playwright", "synapselogs", id);
    await fse.ensureDir(synapseLogsPath);

    await dockerLogs({
        containerId: id,
        stdoutFile: path.join(synapseLogsPath, "stdout.log"),
        stderrFile: path.join(synapseLogsPath, "stderr.log"),
    });

    await dockerStop({
        containerId: id,
    });

    await fse.remove(synCfg.configDir);
    synapses.delete(id);
    console.log(`Stopped synapse id ${id}.`);
}



interface Credentials {
    accessToken: string;
    userId: string;
    deviceId: string;
    homeServer: string;
}

export async function registerUser(synapse: SynapseInstance, username: string, password: string, displayName?: string,): Promise<Credentials> {
    const url = `${synapse.baseUrl}/_synapse/admin/v1/register`;
    const context = await request.newContext({ baseURL: url }); 
    const { nonce } = await (await context.get(url)).json();
    const mac = crypto.createHmac('sha1', synapse.registrationSecret).update(
        `${nonce}\0${username}\0${password}\0notadmin`,
    ).digest('hex');
    const response = await (await context.post(url, {
        data: {
            nonce,
            username,
            password,
            mac,
            admin: false,
            displayname: displayName,
        }
    })).json();
    return {
        homeServer: response.home_server,
        accessToken: response.access_token,
        userId: response.user_id,
        deviceId: response.device_id,
    };
}
