<div id="top"></div>



<!-- PROJECT LOGO -->
<br />
<div align="center">
  <!-- <a href="https://github.com/">
    <img src="" alt="Logo"  height="80">
  </a> -->

  <h3 align="center">API DATA CACHE - WIP</h3>

  <p align="center">
    Reduce data transfer from servers by storing structured data locally.
    <br />
    <a href="https://cviolbarbosa.github.io/api-data-cache/"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/">View Demo</a>
    ·
    <a href="https://github.com/cviolbarbosa/api-data-cache/issues">Report Bug</a>
    ·
    <a href="https://github.com/cviolbarbosa/api-data-cache/issues">Request Feature</a>
  </p>
</div>

## About The Project

This project originated from the necessity of reducing the data trafic and serialization time of large objects from backend to frontend. The api-data-cache decreases considerably lag times improving the application responsiveness  and user experience. The implementation is inspired in the Redux; each data object is accessible to all application views from a central immutable store - the data cache. 

This library is in principle designed to work with the HtttpClient from Angular 2+, but it can be easily adapted to other platforms (see below).


### List of features
*   A single class to extend services containing CRUDE methods: CREATE, LIST, GET, UPDATE, DELETE.
*   Long period cache for `get` operations and short period cache for `list` operations.
*   Advanced list method to retrieved filtered list of objects.
*   Special options for data serialization in update and create operations.

## Getting Started

### Installation

```shell 
$ npm i api-data-cache  --save
```

### Usage

A common scenario is when the app has a `list view` and a `detail view`. In the list view many objects are displayed, and only the most important properties are loaded. In the detail view, a single object is shown with all properties and nested relationships. To take maximum advantage of the api-data-cache, the backend should use shallow or partial serializers in listing operations, and provide fully-nested serializer only for detail views.

As an example, let's consider an app that list books using the following the default REST API pattern:

* GET /book/      => retrieve list with many objects.
* POST /book/     => create a new book and return its id.
* GET /book/:id/   => retrieve the detailed data of a single book of a given id.
* PATCH /book/:id/ => update the book of a given id.

#### book.service.ts
```js 
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {BookModel} from './app.models'
import {ApiDataCacheService} from 'api-data-cache';

const my_edit_create_serializer = (data) => data;

@Injectable({
  providedIn: 'root'
})
export class BookService extends ApiDataCacheService <BookModel> {

  constructor(public http: HttpClient) {
      super(http);
      this.url = '/book/'; 
      this.maxCachedListAge = 2;   // 0  - 5 seconds       
      this.maxCachedGETAge = 300;  // 30 - 3600 seconds
      this.serializer = my_edit_create_serializer;  // optional
  }
```


#### book.component.ts
```js
import { Component } from '@angular/core';
import { BookService } from '@ngx-formly/core';

@Component({
  selector: 'app-root',
  template: `
          <div *ngIf="books" style="display: flex" >
                <div *ngFor="let book in books" (click)="selectBook(book.id)" style="border: solid">
                      {{books | json}}
                </div>
                <div style="border: solid">
                  {{selectedBook | json}} 
                </div>
          </div>
  `,
})
export class AppComponent {
  public books: Partial<BookModel>[];
  public selectedBook: BookModel;

  constructor(bookService: BookService) {
  // results are cached for 2 seconds, avoiding needless requests to the server.
    	this.bookService.list().subscribe(r => this.books = r);
  }

  selectBook(id: string | number){
  // results are cached for 300 seconds, avoiding needless requests to server when browsing through items.
      this.bookService.get(id).subscribe(r => this.selectedBook = r);
  }

  updateBook(book:Partial<BookModel>){
  // dispatch the patch request and update instance in cache.
      this.bookService.edit(book).subscribe();
  }

  createBook(book:Partial<BookModel>){
  // dispatch the patch request and update instance in cache.
      this.bookService.create(book).subscribe();
  }
}
```



### Contributing
This package is in development. 
### Authors 
*   Carlos E. Viol Barbosa


### License

This project is licensed under the MIT License
