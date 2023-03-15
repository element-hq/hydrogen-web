Pseudo code of how SSO should work:

```js
// 1. Starting SSO
const loginOptions = await sessionContainer.queryLogin("matrix.org");
// every login option (the return type of loginOptions.password and loginOptions.sso.createLogin)
// that can be passed in to startWithLogin will implement a common LoginMethod interface that has:
// - a `homeserver` property (so the hsApi can be created for it before passing it into `login`)
// - a method `async login(hsApi, deviceName)` that returns loginData (device_id, user_id, access_token)

// loginOptions goes to the LoginViewModel

// if password login, mapped to PasswordLoginViewModel
if (loginOptions.password) {
    sessionContainer.startWithLogin(loginOptions.password(username, password));
}

// if sso login, mapped to SSOLoginViewModel
if (loginOptions.sso) {
    const {sso} = loginOptions;
    // params contains everything needed to create a callback url:
    //      the homeserver, and optionally the provider
    let provider = null;
    if (sso.providers) {
        // show button for each provider
        // pick the first one as an example
        provider = providers[0];
    }
    // when sso button is clicked:
    // store the homeserver for when we get redirected back after the sso flow
    platform.settingsStorage.setString("sso_homeserver", loginOptions.homeserver);
    // create the redirect url
    const callbackUrl = urlRouter.createSSOCallbackURL(); // will just return the document url without any fragment
    const redirectUrl = sso.createRedirectUrl(callbackUrl, provider);
    // and open it
    platform.openURL(redirectUrl);
}

// 2. URLRouter, History & parseUrlPath will need to also take the query params into account, so hydrogen.element.io/?loginToken=abc can be converted into a navigation path of [{type: "sso", value: "abc"}]

// 3. when "sso" is on the navigation path, a CompleteSSOLoginView is shown.
// It will use the same SessionLoadView(Model) as for password login once login is called.
// 
// Also see RootViewModel._applyNavigation.
//
// Its view model will do something like:

// need to retrieve ssoHomeserver url in localStorage
const ssoHomeserver = platform.settingsStorage.getString("sso_homeserver");
// need to retrieve loginToken from query parameters
const loginToken = "..."; // passed in to view model constructor
const loginOptions = await sessionContainer.queryLogin(ssoHomeserver);
sessionContainer.startWithLogin(loginOptions.sso.createLogin(loginToken));
```
