# How to create .pem files

1. `openssl genrsa -out privatekey.pem 1024`
2. `openssl req -new -key privatekey.pem -out certrequest.csr`
3. `openssl x509 -req -in certrequest.csr -signkey privatekey.pem -out certificate.pem`
