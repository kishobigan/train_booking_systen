import { FlatCompat } from '@eslint/eslintrc';
import { globalIgnores } from 'eslint/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const baseDirectory = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory });
const config = [globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']), ...compat.extends('next/core-web-vitals', 'next/typescript'), { rules: { '@typescript-eslint/no-explicit-any': 'off' } }];
export default config;
