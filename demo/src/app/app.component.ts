import { Component, OnInit } from '@angular/core';
import {  DataPageRequest, AdvancedListOptions } from 'api-data-cache';
import { MeasurementService, MeasurementServiceNoCache, MeasurementModel } from './service';


@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styles: []
})
export class AppComponent implements OnInit{
  selectedItem: MeasurementModel;
  selectedItem2: MeasurementModel;

  itemList: Partial<MeasurementModel>[];
  itemList2: Partial<MeasurementModel>[];

  pageObject = new DataPageRequest();
  page: number = 1;
  filterObj: any = {};
  useAdvancedList: boolean = true;
  
  constructor(public measureService: MeasurementService, public measureServiceCacheDisable: MeasurementServiceNoCache){
    this.pageObject.itemsPerPage = 10;
  }

  ngOnInit(){
    this.list('', 0);
  }

  list(query:string, pageOffset:number){
    this.pageObject.page += pageOffset;
    this.pageObject.page = this.pageObject.page < 0?  0 : this.pageObject.page;
    this.listWithoutCache(query);
    this.listWithCache(query);   
  }

  get(id:number){
    this.measureServiceCacheDisable.get(id).subscribe(r => this.selectedItem = r);
    this.measureService.get(id).subscribe(r => this.selectedItem2 = r); 
  }


  listWithoutCache(query:string){
    this.measureServiceCacheDisable.list(query, this.pageObject).subscribe(r => this.itemList = r.list);
  }
  

  listWithCache(query:string){
    if (this.useAdvancedList) {
      const options: AdvancedListOptions = new AdvancedListOptions();
      options.filter= this.filterObj;
      this.measureService.advancedList(query, this.pageObject, options).subscribe(r => this.itemList2 = r.list);
    } else {
      this.measureService.list(query, this.pageObject).subscribe(r => this.itemList2 = r.list);
    }
   
  }


  resetCounters() {
    localStorage.setItem('dataTransfer1','0');
    localStorage.setItem('dataTransfer2','0');
  }


  get dataCounter1(): any {
    return Number(localStorage.getItem('dataTransfer1'))/1024;
  }

  get dataCounter2(): any {
    return Number(localStorage.getItem('dataTransfer2'))/1024;

  }

}
