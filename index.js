const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
var names = [];
var clients = [];
var messages = {};

app.get('/', function(req, res) {
    res.render('index.ejs');
});

const server = http.listen(3000, function() {
    console.log('listening on *:3000');
});

io.sockets.on('connection', function(socket) {

    // On first connect
    socket.join(socket.id);
    socket.emit('cls');
    socket.emit('chat_message', '&#62;<i>Please enter your name:</i>');
    clients.push(socket);

    socket.on('disconnect', function(username) {
      if (socket.username != undefined) {
        io.to(Array.from(socket.rooms)[0]).emit('chat_message', '&#62;<i>' + socket.username + ' left the chat</i>');
        names.splice(names.indexOf(socket.username), 1);
        clients.splice(clients.indexOf(socket), 1);
      }
    });

    socket.on('chat_message', function(message) {

        // If socket is on name select

        if (socket.rooms.has(socket.id)) {
          var words = message.split(' ');
          if (words.length > 1) {socket.emit('chat_message', '<i>&#62;Enter a name with only one word.</i>');}
          else {
            var name;
            if (message.replace(/ /g, '') != '') {
              name = removeHTML(message);
            }
            else {
              const num = Math.floor(Math.random() * 9000) + 1000;
              name = "Unnamed" + num;
            }
            if (names.includes(name)) {
             socket.emit('chat_message', '&#62;<i>That name is taken. Please enter a different name:</i>')
            }
            else {
              socket.username = name;
              names.push(name);
              socket.broadcast.to("general").emit('chat_message', '&#62;<i>' + socket.username + ' joined the chat.</i>');
              socket.emit('chat_message', '&#62;<i>Your name has been set to ' + socket.username + ". You can now chat.</i>");
              socket.leave(socket.id);
              socket.join("general");
              if (getOnlineUsers("general") == 1) {messages["general"] = [];}
            }
          }
        }

        // If socket is not on name select

        else {
          if (message != '') {
            if (message.split('')[0] == '!') {

              // Commands

              var words = message.split(' ');

              // Help command

              if (words[0] == '!help') {
                socket.emit('chat_message', '&#62;<i>Here is a list of commands:</i>');
                socket.emit('chat_message', '&#62;<i></i>');
                socket.emit('chat_message', '&#62;<i>!pm [username] [message] - Private Message a User.</i>');
                socket.emit('chat_message', '&#62;<i>!name - Change your name.</i>');
                socket.emit('chat_message', '&#62;<i>!room (room) (tag - /k /c) - Set the room you are in. Leave blank to go back to the default room.</i>');
                socket.emit('chat_message', '&#62;<i>!cls - Clears the screen.</i>');
                socket.emit('chat_message', '&#62;<i>!online - Shows the online users in your room as well as the user count.</i>');
                socket.emit('chat_message', '&#62;<i>!reloadmsgs - Clears and re-displays messages from your room.</i>');
              }

              // PM command

              else if (words[0] == '!pm') {
                if (words.length < 3) {socket.emit('chat_message', '<i>ERROR: Not enough arguments.</i>');}
                else {
                  var pmUser = findUser(words[1]);
                  if (pmUser != undefined) {
                    var pmMsg = words[2];
                    for(var i = 3; i < words.length; i++) {
                      pmMsg = pmMsg + " " + words[i];
                    }
                    socket.emit('chat_message', '<i> You messaged ' + pmUser.username + ": " + removeHTML(pmMsg) + "</i>");
                    pmUser.emit('chat_message', '<i>' + socket.username + ' messaged you: ' + removeHTML(pmMsg) + "</i>");
                  }
                  else {socket.emit('chat_message', '<i>ERROR: That user is not online.</i>');}
                }
              }

              // Name command

              else if (words[0] == '!name') {
                if (words.length < 2) {socket.emit('chat_message', '<i>ERROR: Not Enough arguments.</i>');}
                else if (words.length > 2) {socket.emit('chat_message', '<i>ERROR: Too many arguments.</i>');}
                else {
                  if (names.includes(words[1])) {socket.emit('chat_message', '&#62;<i>That name is taken. Please enter a different name.</i>')}
                  else {
                    names.splice(names.indexOf(socket.username), 1);
                    socket.broadcast.to(Array.from(socket.rooms)[0]).emit('chat_message', '&#62;<i>' + socket.username + ' changed their name to ' + words[1] + ".</i>");
                    socket.username = words[1];
                    names.push(words[1]);
                    socket.emit('chat_message', '&#62;<i>Your name has been changed to ' + socket.username + ".</i>");
                  }
                }
              }

              // Room command

              else if (words[0] == '!room') {
                if (words.length > 3) {socket.emit('chat_message', '<i>ERROR: Too many arguments.</i>');}
                else {
                  var roomIsId = true;
                  for (var i = 0; i < clients.length; i++) {
                    if (words[1] == clients[i].id) {
                      roomIsId = false;
                      break;
                    }
                  }
                  if (words[1] == undefined) {words.push('general');}
                  if (words[1] == '') {words[1] = 'general'}
                  if (roomIsId) {
                    let oldRoom = Array.from(socket.rooms)[0];
                    socket.leave(oldRoom);
                    if (getOnlineUsers(oldRoom) == 0) {
                      delete messages[oldRoom];
                    }
                    socket.broadcast.to(oldRoom).emit('chat_message', '&#62;<i>' + socket.username + ' left the room.</i>');
                    socket.broadcast.to(words[1]).emit('chat_message', '&#62;<i>' + socket.username + ' joined the room.</i>');
                    socket.join(words[1]);
                    if (getOnlineUsers(words[1]) == 1) {
                      messages[words[1]] = [];
                      if (words[2] != '/k' && words[2] != '/c') {
                        socket.emit('cls');
                      }
                      else if (words[2] == '/c') {socket.emit('cls');}
                    }
                    else {
                      if (words[2] != '/k' && words[2] != '/c') {
                        socket.emit('cls');
                        for (var i = 0; i < messages[words[1]].length; i++) {
                          socket.emit('chat_message', messages[words[1]][i]);
                        }
                      }
                      else if (words[2] == '/c') {socket.emit('cls');}
                    }
                    socket.emit('chat_message', '&#62;<i>Joined the room: ' + words[1] +  '</i>');
                  }
                  else {
                    socket.emit('chat_message', '<i>ERROR: Unable to join that room.</i>');
                  }
                }
              }

              // Cls command

              else if (words[0] == '!cls') {socket.emit('cls');}

              // Online command

              else if (words[0] == '!online') {
                var count = 0;
                for (var i = 0; i < clients.length; i++) {
                  if (Array.from(clients[i].rooms)[0] == Array.from(socket.rooms)[0]) {
                    socket.emit('chat_message', '&#62;<i>' + clients[i].username + '</i>');
                    count++;
                  }
                }
                socket.emit('chat_message', '&#62;<i>Users in your room: ' + count + '</i>');
              }

              // ReloadMsgs command

              else if (words[0] == '!reloadmsgs') {
                socket.emit('cls');
                for (var i = 0; i < messages[Array.from(socket.rooms)[0]].length; i++) {
                  socket.emit('chat_message', messages[Array.from(socket.rooms)[0]][i]);
                }
              }

              else {socket.emit('chat_message', '<i>ERROR: Unknown command.</i>');}
            }
            else {
              io.to(Array.from(socket.rooms)[0]).emit('chat_message', '<strong>' + socket.username + '</strong>: ' + removeHTML(message));
              messages[Array.from(socket.rooms)[0]].push('<strong>' + socket.username + '</strong>: ' + removeHTML(message));
            }
          }
        }
    });
});

function removeHTML(input) {
  return input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/ /g, '&nbsp;');
}

function findUser(username) {
  for(var i = 0; i < clients.length; i++) {
    if (clients[i].username == username) {
      return (clients[i]);
    }
  }
}
function getOnlineUsers(room) {
  var count = 0;
  for (var i = 0; i < clients.length; i++) {
    if (Array.from(clients[i].rooms)[0] == room) {count = count + 1;}
  }
  return count;
}