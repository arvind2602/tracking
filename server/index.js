const express = require('express');
const routes = require('./controller/routes');
const errorHandler = require('./utils/errorHandler');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use('/api', routes);

app.get('/', (req, res) => {
    res.json("Hello world");
});

app.use(errorHandler);

module.exports = app;

app.listen(5000, ( )=> {
    console.log("listening and always listen to port 5000");
})
