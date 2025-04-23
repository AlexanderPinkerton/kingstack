import sharedConfig from '@kingstack/eslint-config';

const overrides = {
    ...compat.extends("next/core-web-vitals", "next/typescript")
}

const eslint_config = [...sharedConfig, overrides]

export default eslint_config;