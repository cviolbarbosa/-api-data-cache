import { Injector, Injectable } from '@angular/core';
import { HttpInterceptor, HttpHandler, HttpRequest } from '@angular/common/http';
import { catchError, map } from 'rxjs/operators';



@Injectable()
export class DataCounterInterceptor implements HttpInterceptor {

  constructor() { }


  intercept(req: HttpRequest<any>, next: HttpHandler) {
    let dataTransfer1: any = window.localStorage.getItem('dataTransfer1') || '0';
    let dataTransfer2: any = window.localStorage.getItem('dataTransfer2') || '0';
    
    return next.handle(req)
           .pipe( map( x => { 
                  if(!x['body']) {return x}
                  if(req.headers.get('DataTracker') === '1'){
                    dataTransfer1 = parseInt(dataTransfer1);
                    dataTransfer1 += JSON.stringify(x['body']).length;
                    window.localStorage.setItem('dataTransfer1', dataTransfer1);
                    console.log("request without api-data-cache", x['body']);
                  }

                  if(req.headers.get('DataTracker') === '2'){
                    dataTransfer2 = parseInt(dataTransfer2);
                    dataTransfer2 += JSON.stringify(x['body']).length;
                    window.localStorage.setItem('dataTransfer2', dataTransfer2);
                    console.log("request with the api-data-cache", x['body']);
                  }
                           
            return x
            
          }))
  }


}
