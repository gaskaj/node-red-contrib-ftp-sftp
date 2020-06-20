/**
 * Copyright 2015 Atsushi Kojo.
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

module.exports = function (RED) {
  'use strict';
  var ftp = require('ftp');
  var fs = require('fs');

    const ReadableStream = require('stream');

    function FtpNode(n) {
    RED.nodes.createNode(this, n);
    var node = this;

    this.options = {
        'host': n.host || 'localhost',
        'port': n.port || 21,
        'secure': n.secure || false,
        'secureOptions': n.secureOptions,
        'user': n.user || 'anonymous',
        'password': n.password || 'anonymous@',
        'pass': n.password || 'anonymous@',
        'connTimeout': n.connTimeout || 10000,
        'pasvTimeout': n.pasvTimeout || 10000,
        'keepalive': n.keepalive || 10000
    };
  }

  RED.nodes.registerType('ftp', FtpNode);

  function FtpInNode(n) {
    RED.nodes.createNode(this, n);
    this.ftp = n.ftp;
    this.operation = n.operation;
    this.filename = n.filename;
    this.localFilename = n.localFilename;
    this.workdir = n.workdir;
    this.savedir = n.savedir;
    this.ftpConfig = RED.nodes.getNode(this.ftp);

    if (this.ftpConfig) {
      var node = this;
      console.log("this.ftpConfig: " + JSON.stringify(this.ftpConfig));
      node.on('input', function (msg) {
        try {
            node.workdir = node.workdir || msg.workdir || './';
            node.savedir = node.savedir || msg.savedir || './';
            node.localFilename = node.localFilename || msg.localFilename || '';

            /*FTP options*/
            node.ftpConfig.options.host = msg.host || node.ftpConfig.options.host;
            node.ftpConfig.options.port = msg.port || node.ftpConfig.options.port;
            node.ftpConfig.options.user = msg.user || node.ftpConfig.options.user;
            node.ftpConfig.options.password = msg.password || node.ftpConfig.options.password;
            node.ftpConfig.options.pass = msg.pass || msg.password || node.ftpConfig.options.pass;

            var JSFtp = require("jsftp");

            switch (node.operation) {
                case 'list':
                    var Ftp = new JSFtp(node.ftpConfig.options);
                    console.log("[http://www.hardingpoint.com] FTP List:" + node.workdir.toString());
                    Ftp.ls(node.workdir,function(err,data){
                        // console.log(data);
                        msg.payload = data;
                        node.send(msg);
                    });
                    break;
                case 'get':
                    var Ftp = new JSFtp(node.ftpConfig.options);
                    var ftpfilename = node.workdir + node.filename;
                    if (msg.payload.filename)
                        ftpfilename = msg.payload.filename;
                    var str = '';
                    console.log("[http://www.hardingpoint.com] FTP Get:" + ftpfilename);
                    Ftp.get(ftpfilename, function(err, socket){
                        if (err) {
                            node.error(err);
                        }else{
                            socket.on("data", function(d){
                                str += d.toString();
                            });

                            socket.on("close", function(err) {
                                if (err)
                                    node.error(err);

                                node.status({});
                                msg.payload = {};
                                msg.payload.filedata = str;
                                msg.payload.filename = ftpfilename;
                                node.send(msg);
                            });
                            socket.resume();
                        }
                    });
                    break;
                case 'put':
                    var newFile = '';
                    if (msg.payload.filename) {
                        newFile = msg.payload.filename;
                    } else if (node.filename == "") {
                        var d = new Date();
                        var guid = d.getTime().toString();

                        if (node.fileExtension == "") {
                            node.fileExtension = ".txt";
                        }
                        newFile = node.workdir + guid + node.fileExtension;
                    } else {
                        newFile = node.workdir + node.filename;
                    }

                    var msgData = '';
                    if (msg.payload.filedata)
                        msgData = msg.payload.filedata;
                    else
                        msgData = JSON.stringify(msg.payload);

                    console.log("[http://www.hardingpoint.com] FTP Put:" + newFile);

                    var Ftp = new JSFtp(node.ftpConfig.options);

                    var buffer = new Buffer(msgData);

                    Ftp.put(buffer, newFile, function(err){
                        if (err)
                            node.error(err);
                        else{
                            node.status({});
                            msg.payload.filename = newFile;
                            node.send(msg);
                        }
                    });
                    break;
                case 'delete':
                    console.log("[http://www.hardingpoint.com] FTP Delete:" + msg.payload.filename);
                    var Ftp = new JSFtp(node.ftpConfig.options);
                    Ftp.raw("dele", msg.payload.filename, function(err, data) {
                        if (err) node.error(err);
                        else{
                            node.status({});
                            node.send(msg);
                        }
                    });
                    break;
            }

      } catch (error) {
          console.log("Caught Error:" + error);
         node.error(error);
      }
    });
    } else {
      this.error('missing ftp configuration');
    }
  }
  RED.nodes.registerType('ftp in', FtpInNode);
}
