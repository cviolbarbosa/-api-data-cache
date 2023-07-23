import * as lodash from 'lodash';

// ----------------------------------------------------------------------------
// Models
// ----------------------------------------------------------------------------
export class DataModel {
  id?: any;
  _id?: any;
  _cacheOutdated?: boolean;
  _serv_timestamp?: any;
  _cacheUpdatedAt?: any;
  _serv_updatedByMe?: boolean;
  _permissions?: any;

  _outdated?: boolean;
  _selected?: boolean;
  _annotation?: any;

  static serialize(data, FieldNames, relationalFields) {
      let output: any = {};
      output = serialize(data, FieldNames, relationalFields);
      for (const attribute in output) {
          if (attribute.startsWith('_')) { delete output[attribute]; }
      }

      return output;
  }
}


export interface FetchOptions {
  url: string;
  data?: any;
  method: 'GET'| 'PUT' | 'PATCH' | 'DELETE' | 'POST' | 'get' | 'put' | 'patch' | 'delete' | 'post';
  headers?: any;
}


export interface DataListResponse<T> {
  listIds?: number[];
  list: T[];
  page_request: DataPageRequest;
}

export interface DataCreationResponse<T> {
  id?: number;
  instance?: T;
}

export class DataPageRequest {
    itemsPerPage: number;
    num_pages?: number;
    page: number;
    orderBy: string[];
    count?: number;
      constructor(){
          this.itemsPerPage = 50;
          this.page = 1;
          this.orderBy= [''];
      }
}

export class AdvancedListOptions {
  filter?: any = {};
  searchScope?: 'local' | 'server' | 'local+server' = 'server';
  includeIds: number[] = [];
  fullNesting?: boolean = false;
}


export function  serialize(originalData: any, fieldNames: string[], relationalFields: string[]) {
  if (!originalData) {return null; }
  const output = {};
  const data = lodash.cloneDeep(originalData);
  for (const fieldName of fieldNames) {
      if (typeof (data[fieldName]) === 'undefined') {
          continue;
      }
      output[fieldName] = data[fieldName];
  }

  for (const modelName of relationalFields) {
      if (typeof (data[modelName]) === 'undefined') {
          continue;
      }
      if (Array.isArray(data[modelName])) {
          output[modelName] = data[modelName]
              .map(value => {
                  if (value === null) { return null; }
                  if (value.hasOwnProperty('id')) { return value.id; }
                  if (typeof (value) === 'number' || typeof (value) === 'string') { return value; }
              });
      } else {
          const value = data[modelName];
          if (value === null) { output[modelName] = null; }
          else if (value.hasOwnProperty('id')) { output[modelName] = value.id; }
          else if (typeof (value) === 'number' || typeof (value) === 'string') { output[modelName] = value; }
      }
  }

  return output;
}