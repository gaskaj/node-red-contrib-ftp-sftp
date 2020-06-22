/**
 * Copyright 2017 Joe Gaska
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

// --------------------------------------------------------------------------------------------------------------
/*

TODO
    Add Get
    Add Delete

 http://ourcodeworld.com/articles/read/133/how-to-create-a-sftp-client-with-node-js-ssh2-in-electron-framework

*/
// --------------------------------------------------------------------------------------------------------------

// STILL VALIDATING CONNECTIVITY
//  -- DID validate it works with list/dir
const fs = require('fs');


module.exports = function (RED) {
  'use strict';

  var sftp = require('ssh2').Client;
  var fs = require('fs');

  function SFtpNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;

    console.log("[http://wwww.HardingPoint.com] SFTP - Config - hmac: " + n.hmac);
    console.log("[http://wwww.HardingPoint.com] SFTP - Config - cipher: " + n.cipher);

    var keyFile = null;
    var keyData = null;
    if (process.env.SFTP_SSH_KEY_FILE){
        keyFile = process.env.SFTP_SSH_KEY_FILE;
        keyFile = require('path').resolve(__dirname,'../../' + keyFile);
        console.log("[http://wwww.HardingPoint.com] SFTP_SSH_KEY_FILE: " + keyFile);

        try{
            keyData = fs.readFileSync(keyFile).toString();
            console.log("[http://wwww.HardingPoint.com PRIVATE KEY] " + keyData);
        } catch (e){
            keyData = null;
            console.log("[http://wwww.HardingPoint.com] SFTP - Read Key File [" + keyFile + "] Exception : " + e);
        }
    }

    if (keyFile && keyData) {
        console.log("[http://wwww.HardingPoint.com] SFTP - Using privateKey: " + keyFile + " Length: " + keyData.toString().length);
        this.options = {
            host: n.host || 'localhost',
            port: n.port || 21,
            username: n.username,
            password: n.password,
            privateKey: keyData,
            algorithms: {
                // hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1', 'hmac-sha1-96'],
                // cipher: ['aes256-cbc']
                hmac: n.hmac,
                cipher: n.cipher
            }
        };
    } else {
        console.log("[http://wwww.HardingPoint.com] SFTP - Using User/Pwd");
        this.options = {
            host: n.host || 'localhost',
            port: n.port || 21,
            username: n.username,
            password: n.password,
            algorithms: {
                // hmac: ['hmac-sha2-256', 'hmac-sha2-512', 'hmac-sha1', 'hmac-sha1-96'],
                // cipher: ['aes256-cbc']
                hmac: n.hmac,
                cipher: n.cipher
            }
        };
    }
  }

  RED.nodes.registerType('sftp', SFtpNode);

  function SFtpInNode(n) {
    RED.nodes.createNode(this, n);
    this.sftp = n.sftp;
    this.operation = n.operation;
    this.filename = n.filename;
    this.localFilename = n.localFilename;
    this.fileExtension = n.fileExtension;
    this.workdir = n.workdir;
    this.savedir = n.savedir;
    this.sftpConfig = RED.nodes.getNode(this.sftp);

    if (this.sftpConfig) {
      var node = this;
      node.on('input', function (msg) {
        try {

          node.workdir = node.workdir || msg.workdir || "./";
          node.savedir = node.savedir || msg.savedir || "./";
          node.localFilename = node.localFilename || msg.localFilename || "";
          node.fileExtension = node.fileExtension || msg.fileExtension || "";

          /*SFTP options*/
          node.sftpConfig.options.host = msg.host || node.sftpConfig.options.host ;
          node.sftpConfig.options.port = msg.port || node.sftpConfig.options.port ;
          node.sftpConfig.options.username = msg.user || node.sftpConfig.options.username || "";
          node.sftpConfig.options.password = msg.password || node.sftpConfig.options.password || "";

          var conn = new sftp();

          this.sendMsg = function (err, result) {
              if (err) {
                  node.error(err.toString(), msg);
                  node.status({ fill: 'red', shape: 'ring', text: 'failed' });
              }
              node.status({});
              conn.end();
              msg.payload = result;
              node.send(msg);
          };

          conn.on('ready', function () {
              switch (node.operation) {
                  case 'list':
                      conn.sftp(function (err, sftp) {
                          if (err) node.error(err, msg);
                          sftp.readdir(node.workdir, node.sendMsg);
                      });
                      break;
                  case 'get':
                      conn.sftp(function(err, sftp) {
                          if (err) node.error(err, msg);
                          var ftpfilename = node.workdir + node.filename;

                          if (msg.payload.filename)
                              ftpfilename = msg.payload.filename;

                          var bufferarray = [];

                          // Be very careful bufferSize too large causes issues with multi threading
                          var stream = sftp.createReadStream(ftpfilename,{ highWaterMark: 1024, bufferSize: 1024 });

                          var counter = 0;
                          var buf = '';
                          var byteSize = 65536;

                          stream.on('data', function(d) {
                              buf += d;
                              counter++;
                              // console.log("Read Chunk ("+ counter + "): " + d.length + " Length: " + buf.length);
                          }).on('end', function() {
                              node.status({});
                              conn.end();
                              console.log("Read Chunks " + counter + " Length: " + buf.length);
                              msg.payload = {};
                              msg.payload.filedata = buf;
                              msg.payload.filename = ftpfilename;
                              node.send(msg);
                          });
                      });
                      break;
                  case 'put':
                      conn.sftp(function (err, sftp) {
                          if (err) node.error(err, msg);
                          var d = new Date();
                          var guid = d.getTime().toString();
                          if (node.fileExtension == "") {
                              node.fileExtension = ".txt";
                          }
                          var newFile = node.workdir + guid + node.fileExtension;
                          if (msg.payload.filename)
                              newFile = msg.payload.filename;

                          var msgData = "";
                          if (msg.payload.filedata)
                              msgData = msg.payload.filedata;
                          else
                              msgData = JSON.stringify(msg.payload);

                          var writeStream = sftp.createWriteStream(newFile, {flags: 'w'});
                          var payloadBuff = new Buffer(msgData);
                          // writeStream.write(payloadBuff, node.sendMsg);
                          writeStream.write(msgData, function(err, result){
                              node.status({});
                              conn.end();
                              msg.payload = {};
                              msg.payload.filename = newFile;
                              node.send(msg);
                          });
                      });
                      break;
                  case 'delete':
                      conn.sftp(function (err, sftp) {
                      if (err) node.error(err, msg);
                          var ftpfilename = node.workdir + node.filename;
                          if (msg.payload.filename)
                              ftpfilename = msg.payload.filename;
                          console.log("Deleting File: " + ftpfilename);
                          sftp.unlink(ftpfilename, function (err) {
                              if (err) {
                                  node.error(err, msg);
                              } else {
                                  console.log("file unlinked");
                                  node.status({});
                                  node.send(msg);
                              }
                              conn.end();
                          });
                      });
                      break;
              }
          });
          conn.on('error', function(error) {
            node.error(error, msg);
          });
          conn.connect(node.sftpConfig.options);

      } catch (error) {
          node.error(error);
      }
    });
    } else {
      this.error('missing sftp configuration');
    }
  }
  RED.nodes.registerType('sftp in', SFtpInNode);
};
