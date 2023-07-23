import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ApiDataCacheService, DataModel, DataCacheOptions} from 'api-data-cache';


export class MeasurementModel extends DataModel {
  name: string;
  data: string;
  start_at: Date;
  end_at: Date;

  static override serialize(data: any) {
    let output = {};
    const FieldNames = ['id', 'name', 'data', 'start_date', 'end_date'];
    const ModelNames: any[] = [];
    output = super.serialize(data, FieldNames, ModelNames);
    return output;
  }
}

@Injectable({
  providedIn: 'root'
})
export class MeasurementService extends ApiDataCacheService <MeasurementModel> { 

  constructor(public http: HttpClient) { 
    const url = 'http://localhost:9000/measurements';      
    const cacheTTL = 100;
    const options: DataCacheOptions = { 
      advancedListEndpoint :'http://localhost:9000/measurements/filtered',
      trailingSlash: true,
      mutationPreventionStrategy: 'simpleRecursiveClone',
      serverResponseTTL: 3
    }
    super(http, url, cacheTTL, options);
    this.requestHeaders = {'headers': new HttpHeaders({'DataTracker':'2'})};
    this.serializer = MeasurementModel.serialize;
  }

}

@Injectable({
  providedIn: 'root'
})
export class MeasurementServiceNoCache extends MeasurementService {

  constructor(http: HttpClient) { 
    super(http);
    this.requestHeaders = {'headers': new HttpHeaders({'DataTracker':'1'})};
    this.disabledCache = true;
  }

} 


