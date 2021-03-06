function LiveLinks(fbname) {

    var firebase = new Firebase('https://' + fbname + '.firebaseio.com/');
    this.firebase = firebase;
    var linksRef = firebase.child('links');
    var usersRef = firebase.child('users');
    var aliasesRef = firebase.child('aliases');
    var instance = this;
    

    this.submitLink = function(url, title) {
        url = url.substring(0, 4) !== 'http' ? 'http://' + url : url;
        var linkRef = linksRef.child(btoa(url));
        linkRef.update({
            title: title
        }, function(error) {
            if (error) {
                instance.onError(error);
            } else {
                var authData = firebase.getAuth();
                linkRef.child('users')
                       .child(authData.uid)
                       .set(true)
                usersRef.child(authData.uid)
                        .child('links')
                        .child(btoa(url))
                        .set(true);
                instance.vote(btoa(url), 1);
                linkRef.child('author')
                       .set(authData.uid);
                linkRef.child('createdAt')
                       .set(Firebase.ServerValue.TIMESTAMP);
            }
        });
    };

    this.vote = function(voteId, voteVal) {
        var authData = firebase.getAuth();
        // console.log(voteId, voteVal);
        if(authData){
            // console.log('The logged user is:' + authData.uid);
            linksRef.child(voteId)
                    .child('votes')
                    .child(authData.uid)
                    .set(voteVal);    
        }
    }

    this.login = function(email, password){
        firebase.authWithPassword ({
            email: email,
            password: password
        }, function(error, authData) {
            if (error) {
                console.log('Error', error);
            }else{
                console.log("Authenticated successfully with payload:", authData);
            }
        });
    };

    this.signup = function(alias, email, password) {
        aliasesRef.child(alias).once('value', function(snapshot) {
            if (snapshot.val()) {
                instance.onError({message: 'That alias is token'});
            }else{
                firebase.createUser({
                email: email,
                password: password
            }, function(error, userData) {
                if (error) {
                    console.log('Error creating user:', error);
                    instance.onError(error);
                }else{
                    console.log('Successfully created user account with uid:', userData.uid);
                    // instance.auth = userData;
                    usersRef.child(userData.uid).set({alias: alias}, function(error) {
                        if (error) {
                            instance.onError(error);
                        } else {
                            aliasesRef.child(alias).set(userData.uid);
                            instance.login(email,password);
                        }
                    });
                }
            });    
            }
        });
    };

    this.logout = function(){
        firebase.unauth();
    };

    function getSubmitters(linkId, userIds){
        if(userIds) {
            $.each(userIds, function(userId) {
                var linkUserRef = linksRef.child(linkId).child('users').child(userId);
                linkUserRef.once('value', function(snapshot) {
                    usersRef.child(snapshot.key())
                            .child('alias')
                            .once('value', function(snapshot) {
                                instance.onLinkUserAdded(linkId, snapshot.val());
                            });
                });
            });
        }
    }

    // overrideable event functions
    this.onLogin = function(user) {};
    this.onLogout = function() {};
    this.onLinksChanged = function(links) {};
    this.onLinkUserAdded = function(linkId, alias) {};
    this.onError = function(error) {};

    //setup long-running firebase listeners 4-3 1:13
    this.start = function() {
// onAuth is really inportant!!!
        firebase.onAuth(function(authData) {
            if (authData) {
                // usersRef = firebase.child('users');
                // firebase.child('users').child(authData.uid) -->
                usersRef.child(authData.uid).once('value', function(snapshot) {
                    instance.user = snapshot.val();
                    instance.onLogin(instance.user); // extremely important!!!
                });
            } else {
                instance.onLogout();
            }
        });
// LinksRef = firebase.child('links')
        linksRef.on('value', function(snapshot) {
            var links = snapshot.val();
            var preparedLinks = [];
            for (var url in links) {
                if (links.hasOwnProperty(url)) {
                    var voteTotal = 0;
                    if(links[url].votes) {
                        $.each(links[url].votes, function(userId, val) {
                            voteTotal += val;
                    });
                    }
                    // for (keyAsId in links[url].users){
                    //     var authorOfUrl = keyAsId;
                    // }
                    preparedLinks.push({
                        title: links[url].title,
                        url: atob(url),
                        id: url, 
                        voteTotal: voteTotal
                    });
                    getSubmitters(url, links[url].users);
                }
            }
            instance.onLinksChanged(preparedLinks);
        });

    };

};


$(document).ready(function(){

    var ll = new LiveLinks('ll-practicing0102');

    $('.show-submit-link').click(function() {
        $('.link-form').toggle();
    });

    $('.link-form form').submit(function(event) {
        event.preventDefault();
        ll.submitLink($(this).find('input.link-url').val(), $(this).find('input.link-title').val());
        $(this).find('input[type=text]').val(''); //.val().blur()
        // return false;
    });

    ll.onLinksChanged = function(links) {
        $('.links-list').empty();
        links.map(function(link){
            var linkElement = "<li data-id='" + link.id + "' class='list-group-item'>" +
             "<span class='vote-total logout-hidden'>" + link.voteTotal + "</span>" +
             "<span class='glyphicon glyphicon-triangle-top up vote logout-hidden' data-val='1'></span>" +
             "<span class='glyphicon glyphicon-triangle-bottom down vote logout-hidden' data-val='-1'></span>" +
                               "<a href='" + link.url + "'  target='_blank'>" + link.title + "</a><br>" +
                               "<span class='submitters'>sumbitted by:</span>" +
                              "</li>";
            $('.links-list').append(linkElement);
        });

        $('.vote').click(function(event) {
            var voteId = $(this).parent().attr('data-id');
            var voteVal = $(this).data('val');
            ll.vote(voteId, voteVal);
         });
    };
// instance.onLinkUserAdded(linkId, snapshot.val());
    ll.onLinkUserAdded = function(linkId, alias) {
        // console.log(linkId+'<br>'+alias);
        var submitters = $("[data-id='"+linkId+"'] span.submitters");
        if(submitters.text().indexOf(alias) == -1) {
            submitters.append("<b> " + alias+'</b>');
        }
    };

    this.vote = function(voteId, voteVal) {
         linksRef.child(voteId)
                 .child('votes')
                 .child(authData.uid)
                 .set(voteVal);
     }

    ll.onLogin = function() {
        $('.auth-links .login, .auth-links .signup, .auth-form').hide();
        $('.auth-links .logout, .show-submit-link').show();
        // $('.logout-hidden').css('display', 'inline-block');
    };

    ll.onLogout = function() {
        $('.auth-links .login, .auth-links .signup').show();
        $('.auth-links .logout, .show-submit-link').hide();
    };

    $(".auth-links .login a").click(function () {
        $('.auth-form, .auth-form .login').show();
        $('.auth-form .signup').hide();
        return false;
    });

    $('.auth-links .signup a').click(function () {
        $('.auth-form .signup form').find('input[type=text]').val('');
        $('.auth-form .signup form').find('input[type=password]').val('');
        $('.auth-form, .auth-form .signup').show();
        $('.auth-form .login').hide();
        return false;
    });
    $('.auth-links .logout a').click(function () {
        ll.logout();
        console.log('Logged out');
        return false;
    });

    $('.auth-form .login form').submit(function(event) {
        var email = $(this).find('input.login-email').val(),
            password = $(this).find('input.login-password').val();
        ll.login(email, password);
        console.log(email, password);
        return false;
    });

    $('.auth-form .signup form').submit(function(event) {
        var alias = $(this).find('input.signup-alias').val(),
            email = $(this).find('input.signup-email').val(),
            password = $(this).find('input.signup-password').val(),
            passwordConfirm = $(this).find('input.signup-password-confirm').val();
        if(password === passwordConfirm){
            ll.signup(alias, email, password);
            console.log(alias, email, password);
        }else{
            console.log('Password and confirmed password are different.')
        }
        return false;
    });

    ll.start();

});


// url: https://ll-practicing0102.firebaseio.com/?page=Security
// practicing-->
// {
//     "rules": {
//         ".read": true,
//         ".write": true,
//         "links": {
//           ".write": "auth != null",
//           "$link": {
//             ".validate": "newData.hasChildren(['title']) && newData.child('title').val().length > 0 && newData.child('title').val().length < 200"  
//           },
//           "createAt": {
//             ".validate": "(!data.exists() || !newData.exists()) && newData.val() <= now"  
//           }
//         },
//         "users": {
//           "$user": {
//             "links": {
//               "$link": {
//                 ".validate": "root.child('links').child($link).child('users').child($user).exists()"  
//               }  
//             }
//           }  
//         }
//     }
// }
// backups-->
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 
// 