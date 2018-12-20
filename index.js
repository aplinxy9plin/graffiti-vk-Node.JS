const VkBot = require('node-vk-bot-api');
const Markup = require('node-vk-bot-api/lib/markup');
const bot = new VkBot("")
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;
var url = "mongodb://localhost:27017/";
var request = require("request");
var FormData = require('form-data');
var http = require('https');
var fs = require('fs')
var path = require('path')
var url = require('url');
MongoClient.connect('mongodb://localhost:27017/graffiti', (err, db) => {
    if(err) throw err;
    console.log('Database is created');
})

bot.command('/start', (ctx) => {
  ctx.reply('Hello!')
})

var download = function(uri, filename, callback){
  request.head(uri, function(err, res, body){
    console.log('content-type:', res.headers['content-type']);
    console.log('content-length:', res.headers['content-length']);

    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
  });
};

bot.on((ctx) => {
  MongoClient.connect(url, function(err, db) {
    if (err) throw err;
    var dbo = db.db("graffiti");
    dbo.collection("users").find({user_id: ctx.message.from_id}).toArray(function(err, result) {
      if (err) throw err;
      if(result.length == 0){
        var myobj = {
          user_id: ctx.message.from_id,
          type: "free",
          status: "auth"
        }
        dbo.collection("users").insertOne(myobj, function(err, result) {
          if (err) throw err;
          console.log("New user is added");
          db.close();
        });
      }else{
        switch (result[0].status) {
          case "auth":
              ctx.reply('Необходимо перейти по ссылке, залогиниться и отправить мне адресную строку https://oauth.vk.com/authorize?client_id=2986065&scope=notify,friends,photos,audio,video,docs,notes,pages,status,offers,questions,wall,groups,messages,notifications,stats,ads,offline&redirect_uri=http://api.vk.com/blank.html&display=page&response_type=token&v=3.0')
              var myquery = { user_id:  ctx.message.from_id};
              var newvalues = { $set: {
                  user_id: ctx.message.from_id ,
                  status: "wait_token",
                  type: result[0].type
                }
              };
          		dbo.collection("users").updateOne(myquery, newvalues, function(err, res) {
          		  if (err) throw err;
                console.log(res);
          		  db.close();
          		});
            break;
          case "wait_token":
            var url_parts = url.parse(ctx.message.text, true);
            var query = url_parts.query;
            console.log(query);
            ctx.reply('123asd')
            break;
          case "registered":
            ctx.reply('Хочешь создать свое граффити или использовать готовый пак?', null, Markup
              .keyboard([
                [
                  Markup.button('Свое', 'primary'),
                  Markup.button('Готовый', 'positive'),
                ]
              ])
              .oneTime()
            )
            var myquery = { user_id:  ctx.message.from_id};
            var newvalues = { $set: {
                user_id: ctx.message.from_id ,
                status: "choose",
                type: result[0].type
              }
            };
        		dbo.collection("users").updateOne(myquery, newvalues, function(err, res) {
        		  if (err) throw err;
              console.log(res);
        		  db.close();
        		});
            break;
          case "Свое":
            ctx.reply('Пришли мне изображение документом.')
            var myquery = { user_id:  ctx.message.from_id};
            var newvalues = { $set: {
                user_id: ctx.message.from_id ,
                status: "themself",
                type: result[0].type
              }
            };
            dbo.collection("users").updateOne(myquery, newvalues, function(err, res) {
              if (err) throw err;
              console.log(res);
              db.close();
            });
          break;
          default:

            if(ctx.message.attachments.length !== 0){
              var uri = ctx.message.attachments[0].doc.url
              var token = '';
              var min=1,
                  max=99999999;
              var random = Math.random() * (+max - +min) + +min;
              download(uri, random+'.png', function(){
                console.log('done');
                var formData = {
                  file: fs.createReadStream(random+'.png')
                };
                getUploadServer(token, (url) => {
                  request.post({url: url, formData: formData}, function(err, httpResponse, body) {
                    if (err) {
                      return console.error('upload failed:', err);
                    }
                    var data = JSON.parse(body);
                    fs.unlinkSync(random+'.png');
                    console.log(data);
                    ctx.reply('Wait...')
                    // apiReq('docs.save', {'file': data.file})
                    saveDoc(data.file, token)
                  });
                })
              });
            }
        }
      }
      db.close();
    });
  });
})

function getUploadServer(token, callback){
  var options = { method: 'POST',
    url: 'https://api.vk.com/method/docs.getUploadServer?type=graffiti',
    qs:
     { v: '5.37',
       access_token:token,
       user_id: '90327755' },
    headers: { 'content-type': 'application/json' },
    body: {'type': 'graffiti'},
    json: true };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    console.log(body);
    callback(body.response.upload_url)
  });
}

function sendMessage(attachment, token, callback){
  var options = { method: 'POST',
    url: 'https://api.vk.com/method/messages.send',
    qs:
     {
       peer_id: 90327755,
       attachment: attachment,
       v: '5.38',
       access_token:token,
       user_id: '90327755' }
   };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    console.log('Message send!');
  });
}

function saveDoc(file, token){
  var options = { method: 'POST',
    url: 'https://api.vk.com/method/docs.save?title=123.png',
    qs:
     { v: '5.92',
       access_token: token,
       user_id: '90327755',
       v: 5.37,
       type: "graffiti",
       file: file
     } };

  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    var x = JSON.parse(body)
    console.log(token);
    sendMessage('doc'+x.response[0].owner_id + '_' + x.response[0].id, token)
  });
}


bot.startPolling()
