module.exports = {
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": [
        "eslint:recommended",
        // "plugin:@typescript-eslint/recommended",
        // "plugin:@typescript-eslint/recommended-requiring-type-checking"
    ],
    "parser": "@typescript-eslint/parser",
    "plugins": ["@typescript-eslint"],
    "parserOptions": {
        "ecmaVersion": 2020,
        "sourceType": "module",
        "project": "./tsconfig.json"
    },
    "rules": {
        "semi": "error",
        "quotes": "error",
        "no-console": "off",
        "no-empty": "off",
        "no-prototype-builtins": "off",
        "no-unused-vars": "warn",
        "@typescript-eslint/no-unused-vars": "warn",
        "quote-props": ["warn", "consistent"]
        // "@typescript-eslint/no-misused-promises": "error",
        // "no-undef": "off",
        // "@typescript-eslint/no-floating-promises": 2,
        // "@typescript-eslint/explicit-function-return-type": "error"
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
