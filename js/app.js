function LiveLinks(fbname) {

    var firebase = new Firebase('https://' + fbname + '.firebaseio.com/');
    this.firebase = firebase;
    var linksRef = firebase.child('links');
    var usersRef = firebase.child('users');
    var instance = this;
    

    this.submitLink = function(url, title) {
        var authData = firebase.getAuth();
        url = url.substring(0, 4) !== 'http' ? 'http://' + url : url;
        linksRef.child(btoa(url)).push({
            title: title
        }, function(error) {
            if (error) {
                instance.onError(error);
            }else{
                linksRef.child(btoa(url))
                        .child('users')
                        .child(authData.uid)
                        .set(true)
                usersRef.child(authData.uid)
                        .child('links')
                        .child(btoa(url))
                        .set(true)
            }
        });
    };

    this.vote = function(voteId, voteVal) {
        var authData = firebase.getAuth();
        console.log(voteId, voteVal);
            linksRef.child(voteId)
                    .child('votes')
                    .child(authData.uid)
                    .set(voteVal);    
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
                        instance.login(email,password);
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
            "<span class='vote-total'>" + link.voteTotal + "</span>" +
            "<span class='glyphicon glyphicon-triangle-top up vote' data-val='1'></span>" +
            "<span class='glyphicon glyphicon-triangle-bottom down vote' data-val='-1'></span>" +
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

    ll.onLogin = function() {
        $('.auth-links .login, .auth-links .signup, .auth-form').hide();
        $('.auth-links .logout').show();
    };

    ll.onLogout = function() {
        $('.auth-links .login, .auth-links .signup').show();
        $('.auth-links .logout').hide();
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





















