# gapdog

## usage

### CLI
- NodeJS `v8.6.0~` recommended
- `npm i -g gapdog`
- One time usage: `gapdog` command only
- Stream logger usage: `gapdog --tail`

### Lambda
- Put S3 dedicated IAM credential to `.env`
- Prepare you AWS CLI credential also (`LambdaFullAccess` needed)
- `npm run deploy`
- You'll see `lambda task`, `S3 bucket` as the result
- I personally intend to integrate with `CloudWatch`, `Athena` and `Redash`

## file structure
- `index.js` is one time command handler
- `bin/gapdog` is JS file that handle global command. This file is exposed to npm command. `package.json`'s `bin` field is specifying here.
- `src/calc` is exporting run function. This function is just fetching some PublicAPI and calculating gap.
