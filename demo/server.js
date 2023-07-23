var express = require('express');
const cors = require('cors');
const port = 9000;
var app = express();

// CREATING AND POPULATING ARRAY IN-MEMORY DATABASE /////////////
const database = [];

function mulberry32(a) {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
}

function genereateData(id) {
    const randomNumber = mulberry32(id);
    const seededString = randomNumber.toString(36).substring(2,18);
    const startDate = new Date('1/15/2023');
    const endDate = new Date(startDate.getTime() + Math.round((id+1)/10*(60 * 60 * 24 * 1000)));
    return {id: id,
            name: seededString,
            data: seededString.repeat(1024),
            start_at: startDate,
            end_at: endDate
        }
}

for (let index = 0; index < 1000; index++) {
    database.push(genereateData(index));
}
const partialSerializer = (d) => ({ id:d.id, 
                                    name: d.name, 
                                    start_at: d.start_at, 
                                    end_at: d.end_at});

/////////////////////////////////////////////////////////////////

app.use(cors());
app.use(express.json());

// SIMPLE LIST OF PARTIALLY SERIALIZED ITEMS
app.get('/measurements/', function(req, res){
    const page = req.query.page || 1,  limit = req.query.limit || 1e9, orderBy = req.query.orderBy || '';

    let data = [...database];
    const linf = (page - 1) * parseInt(limit),  lsup = linf + parseInt(limit);
    if (orderBy) data.sort((a,b) => a[orderBy] > b[orderBy]? 1 :-1 )
    data = data.slice(linf, lsup);
    data = data.map(partialSerializer); 

    const list = data;
    const page_request = {num_pages: Math.ceil(data.length/limit), page, orderBy}

    res.send({list, page_request});
  });


// GET INDIVIDUAL FULL-SERIALIZED ITEM
app.get('/measurements/:id', function(req, res){
  data = database[req.params.id];
  res.send(data);
});


// API-DATA-CACHE LIST ITEMS
app.post('/measurements/filtered', function(req, res){
    const page = req.query.page || 1,  limit = req.query.limit || 1e9, orderBy = req.query.orderBy || '';
    const cachedIds = req.body.cachedIds, filterObj = req.body.filter; fullNest = req.body.fullNesting;
    const excludeCachedIds =  (d) => !cachedIds.includes(d.id);

    let data = [...database];
    const linf = (page - 1) * parseInt(limit),  lsup = linf + parseInt(limit);
    if (orderBy) data.sort((a,b) => a[orderBy] > b[orderBy]? 1 :-1 )
    data = data.slice(linf, lsup);
    if (!fullNest) data = data.map(partialSerializer); 

    const listIds= data.map( d => d.id);
    const list = data.filter(excludeCachedIds); 
    const page_request = {num_pages: Math.ceil(data.length/limit), page, orderBy}

    res.send({listIds, list, page_request});
});




app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
})