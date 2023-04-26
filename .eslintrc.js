module.exports = {
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2020,
        "sourceType": "module"
    },
    "rules": {
        "no-console": "off",
        "no-empty": "off",
        "no-prototype-builtins": "off",
        "no-unused-vars": "warn"
    },
    "globals": {
        "DEFINE_VERSION": "readonly",
        "DEFINE_GLOBAL_HASH": "readonly",
        "DEFINE_PROJECT_DIR": "readonly",
        // only available in sw.js
        "DEFINE_UNHASHED_PRECACHED_ASSETS": "readonly",
        "DEFINE_HASHED_PRECACHED_ASSETS": "readonly",
        "DEFINE_HASHED_CACHED_ON_REQUEST_ASSETS": "readonly"
    }
};
