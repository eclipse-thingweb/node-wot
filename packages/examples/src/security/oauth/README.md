# oAuth example
The example is composed by two actors: one Thing that expose an action with oAuth2.0 client credential security constraint and a client who want to use that function. In the example, we are using an utility server to generate tokens and validate client credentials. Therefore, the **wot-consumer** force the action `href` to be the same as the utility server with the goal to validate the obtained oAuth2.0 token. In the feature the exposing servient could also play this role. 

## run the example
Set the current working directory to this folder. Then execute:
```bash
npm install
npm run build
```
After this follow the procedure described in [here](../../README.md) and remove the unwanted line of codes inside the scripts `./dist/consumer.js` and `./dist/exposer.js`.

Now you are ready to run the example.

```bash
# start the server
npm run server
```
in a different terminal 

```bash
# start the exposer
npm run start:exposer
```
Finally, in other terminal
```bash
npm run start:consumer
```

you should see the following line at the end of consumer log:
```bash
oAuth token was Ok!
```
This confirm that the oAuth flow was completed successfully. Now you can have fun revoking the access to the consumer script. Go
to `./memory-model.js` and try to remove the string `"limited"` from the grants. Run again the example and you will see that the action is not executed and an error is returned by the client. 

## Where is a JS version?
See [here](../../../examples/security/oauth)
