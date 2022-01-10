#nodemon -w "./**" --ext "ts,json,jsonld" --exec "npm run build; npm run test test/ThingModelHelperTest.ts"
nodemon -w "./**" --ext "ts,json,jsonld" --exec "npm run build; npm run test test/thing-model"
#nodemon -w "./**" --ext "ts,json,jsonld" --exec "npm run build; npm run test test/thing-model/ThingModelHelperCompositionTest"
#nodemon -w "./**" --ext "ts,json,jsonld" --exec "npm run build; npm run test test/thing-model/ThingModelHelperTest"
