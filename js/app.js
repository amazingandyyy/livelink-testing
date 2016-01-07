function LiveLinks(fbname) {

    var firebase = new Firebase('https://' + fbname + '.firebaseio.com/');
    this.firebase = firebase;
    var linksRef = firebase.child('links');
    var usersRef = firebase.child('users');
    var instance = this;

    this.submitLink = function(url, title) {
        url = url.substring(0, 4) !== 'http' ? 'http://' + url : url;
        linksRef.child(btoa(url)).set({
            title: title
        });
    };

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
                    preparedLinks.push({
                        title: links[url].title,
                        url: atob(url)
                    })
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
            var linkElement = "<li data-id='" + link.id + "' class='list-group-item'>"+
                              "<a href='" + link.url + "'  target='_blank'>" + link.title + "</a><br>"+
                              "<span class='submitters'>sumbitted by:</span>"+
                              "</li>";
            $('.links-list').append(linkElement);
        });
    };

    ll.onLinkUserAdded = function() {
        var submitters = $("[data-id='"+linkId+"'] span.submitters");
        if(submitters.text().indexOf(alias) == -1) {
            submitters.append(" " + alias);
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





















