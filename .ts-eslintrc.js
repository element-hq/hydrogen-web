module.exports = {
    root: true,
    env: {
        "browser": true,
        "es6": true
    },
    extends: [
        "eslint:recommended"
        // "plugin:@typescript-eslint/recommended",
        // "plugin:@typescript-eslint/recommended-requiring-type-checking",
    ],
    parser: '@typescript-eslint/parser',
    parserOptions: {
        "ecmaVersion": 2020,
        "sourceType": "module",
        "project": "./tsconfig.json"
    },
    plugins: [
        '@typescript-eslint',
    ],
    rules: {
        "no-console": "off",
        "no-empty": "off",
        "no-prototype-builtins": "off",
        "no-unused-vars": "warn",
        "@typescript-eslint/no-floating-promises": 2,
        "@typescript-eslint/no-misused-promises": 2
    }
};
