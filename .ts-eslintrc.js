module.exports = {
    root: true,
    env: {
        "browser": true,
        "es6": true
    },
    extends: [
    //    "plugin:@typescript-eslint/recommended",
    //    "plugin:@typescript-eslint/recommended-requiring-type-checking",
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
        "@typescript-eslint/no-floating-promises": 2,
        "@typescript-eslint/no-misused-promises": 2,
        "semi": ["error", "always"]
    }
};
