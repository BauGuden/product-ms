import 'dotenv/config';
import * as joi from 'joi';

interface EnvVars {
    PORT: number;
}

const envsSchema = joi.object({
    PORT: joi.number().required(),
})
.unknown();

const { error, value: value1 } = envsSchema.validate(process.env);

if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

const envVars: EnvVars = value1;

export const envs = {
    port: envVars.PORT, 
}