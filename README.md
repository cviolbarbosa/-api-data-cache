<div id="top"></div>



<!-- PROJECT LOGO -->
<br />
<div align="center">
  <!-- <a href="https://github.com/">
    <img src="helyos_logo.png" alt="Logo"  height="80">
  </a> -->

  <h3 align="center">Array Simple Query</h3>

  <p align="center">
    A convenient lib to manipulate object in JavaScript arrays.
    <br />
    <a href="https://cviolbarbosa.github.io/array-simple-query/"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/">View Demo</a>
    ·
    <a href="https://github.com/cviolbarbosa/array-simple-query/issues">Report Bug</a>
    ·
    <a href="https://github.com/cviolbarbosa/array-simple-query/issues">Request Feature</a>
  </p>
</div>

## About The Project

Convenient functions to query and change objects in a JavaScript array. It is useful to manipulate local storages mirroring a server database.


### List of features
*   Get and object using queries.
*   Filter array objects using nested queries.
*   Use queries to delete and update objects inside the array.

## Getting Started

### Installation

```shell 
$ npm i array-simple-query  --save
```

### Usage

```js 

import * as ASQ from 'array-simple-query';

const books = [{ 'id': 1, 'title': 'English course', 'author': {first_name: 'Joe', last_name:'Doe'},       'year': 2009 },
            { 'id': 2, 'title': 'Italian course', 'author': {first_name: 'Pinco', last_name:'Pallino'}, 'year': 2010 },
            { 'id': 3, 'title': 'German course', 'author': {first_name: 'Max', last_name:'Musterman'}, 'year': 2009 },
            { 'id': 4, 'title': 'Portugues course', 'author': {first_name: 'Ciclano', last_name:'Silva'}, 'year': 2010 }];

// simple query
const englishBook =  ASQ.getObject(books, {'title':'English course'});

//nested query
const pallinosBook = ASQ.getObject(books, {'author.last_name':'Pallino'});

//negation
const nonGermanBooks = ASQ.filterObjects(books,{'!title': 'German course'});

//deletion
const positionOfDeletedElements = ASQ.deleteObjects(books, {'year': 2009});
```


### Contributing
This package is in development. 
### Authors 
*   Carlos E. Viol Barbosa


### License

This project is licensed under the MIT License
