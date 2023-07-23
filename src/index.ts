import { AdvancedListOptions, DataCreationResponse, DataListResponse, DataModel, DataPageRequest, FetchOptions } from './api-data-cache.models';
import { isObservable, map, Observable, of, Subject, tap } from 'rxjs';
import * as ASQ from 'array-simple-query';
import * as lodash from 'lodash';
import { hashCode, searchDeep, urlJoin } from './utils';

export * from './api-data-cache.models';

export interface HttpClientProxy {
    get:  (...params) => Observable <any>; 
    put:  (...params) => Observable <any>; 
    patch:  (...params) => Observable <any>; 
    post: (...params) => Observable <any>; 
    request: (...params) => Observable <any>; 
}

/**
 * Customization of data service.
 * @param {number} serverResponseTTL - The cached service response time to live. It is only applied for listing, to improve pagination operations. (default 3 seconds)
 * @param {string} advancedListEndpoint - Additional endpoint for filtering operations used in the `advancedList` method.
 * @param {string} mutationPreventionStrategy - Strategy to avoid mutation of the cache data: 'simpleRecursiveClone' | 'jsonDeepCopy'| 'cloneDeep'| 'none'
 * @param {trailingSlash} boolean - Adds a back slash at the end of the request url.
 */
export class DataCacheOptions {
  advancedListEndpoint?: string = '';
  mutationPreventionStrategy?: 'none' | 'simpleRecursiveClone' | 'jsonDeepCopy'| 'cloneDeep' = 'simpleRecursiveClone';
  trailingSlash?: boolean = false;
  serverResponseTTL?: number = 3;
}


export class ApiDataCacheService <T> {

  /**
   * Is the data service initiated?
   */
  public started: boolean = false;

  /**
   * Disable new updates to be cached.
  */
  public disabledCache = false;

  /**
   * Set additional headers to all requests of the service.
  */
  public requestHeaders = {};


  /**
   * By setting the parameter `setFullRecordOnGet` to `true`, 
   * the retrieved record using the `get()` method will be automatically marked as `full`.
   * In this context, 'full' means that the record possesses all fields, including any required nested fields.
   * On the other hand, if `setFullRecordOnGet` is set to `false`, the retrieved record will not be marked as 'full'.
   * In this case, you need to add a calculated field `_full: true` to the fully serialized records on the server-side.
   * 
  */
  public setFullRecordOnGet = true;

  /**
   * Function to serialize the instance data before sending to serve in the `edit()` and `create()` methods.
   */
  public serializer: (data) => { }; 

  // Data cache properties
  private opt = new DataCacheOptions();
  private cachedResponses = {};
  private cachedPUT = {};
  private dataCached: T[] = [];
  private httpProxy: HttpClientProxy;
  public cachedVersionInfo: { [id: string]: any[]} = {};


  /**
   * Create a Cached Data Service.
   * @param {HttpClientProxy} httpProxy - A class implementing the Angular HtttpClient methods `get`,`patch`,`post`, `delete` and `request`.
   * @param {string} url - The base CRUD url.
   * @param {number} cacheTTL - The data cache time to live. (default 100 seconds, minimum 10 seconds)
   * @param {DataCacheOptions} options - Additional endpoint for filtering operations used in the `advancedList` method.
   */
  constructor(httpProxy: any, public url: string, private cacheTTL = 100, options: DataCacheOptions = {} ) {   // Expiration for Data Caching
        this.httpProxy = httpProxy as HttpClientProxy;
        this.url = url;
        this.opt = {...this.opt, ...options}
        this.setCacheWatcher();

  }

  private setCacheWatcher(){
    let cacheMonitorPeriod = this.cacheTTL/4;
    if (cacheMonitorPeriod < 10) { cacheMonitorPeriod = 10};
    setInterval(() => this.markExpiredItemsOutdated(), cacheMonitorPeriod);
  }

  // suggar around $http
  private fetch<T>(options: FetchOptions): Observable <any> {     
    const method = options.method.toLowerCase();

    switch (method) {
      case 'get':
        return this.httpProxy.get(`${options.url}`, this.requestHeaders);
      case 'put':
        return this.httpProxy.put(`${options.url}`, options.data, this.requestHeaders);
      case 'patch':
        return this.httpProxy.patch(`${options.url}`, options.data, this.requestHeaders);
      case 'post':
        return this.httpProxy.post(`${options.url}`, options.data, this.requestHeaders);
      case 'delete':
        return this.httpProxy.request('delete', `${options.url}`, { body: options.data });
      default:
        return this.httpProxy.get(`${options.url}`, this.requestHeaders);;
    }
  
  }


    // --------------------------------------------------------------------------
    // Methods to Cache the Entity Data
    // --------------------------------------------------------------------------

    initiateService() { 
      this.started = true;
    }

   /**
   * Mark all cached data as outdated
   */
    markAllOutdated() {
        this.dataCached.forEach(d => d['_cacheOutdated'] = true);
    }

   /**
   * Mark cached record as outdated
   * @param {number} id - Instance id to be marked as outdated.
   */
    markOutdated(id: number | string) {
        const itemCached = ASQ.getObject(this.dataCached, { id: id });
        itemCached['_cacheOutdated'] = true;
    }

    private markExpiredItemsOutdated() {
      const now = new Date();
      for (let index = 0; index < this.dataCached.length; index++) {
        const itemCached = this.dataCached[index];
        if ((now.getTime() - itemCached['_cacheUpdatedAt']) / 1000 > this.cacheTTL) {
          itemCached['_cacheOutdated'] = true;
        } else {
          break;
        }
      }
    }


   /**
   * Free memory by deleting outdated instances from the cache.
   */
    deleteOutdatedCache() {
      ASQ.deleteObjects(this.dataCached, {_cacheOutdate:true});
    }

 /**
 * Updates an item in the cached. The original data is actually deleted and a new object is added at the end of the array.
 * In this way, the data cache becomes ordered by `_cacheUpdatedAt`, facilitating the expiration of old cache.
 *
 * @param item Object
 * @param retrievalTimestamp Date time when the data was requested
 *
 * @return The cached item object from data cache array.
 */
    private updateItemMetaCache(item, retrievalTimestamp: number | null = null): any {
        this.cachedVersionInfo[item.id] = [];
        if (typeof (item) !== 'object') { return null; }
    
        const itemInputClone = lodash.cloneDeep(item);
        const arrayCache = this.dataCached;

        if (this.disabledCache) { return itemInputClone;}
        
        let itemCached = ASQ.getObject(arrayCache, { id: item.id });
        if (itemCached) {
        // Item already exists
            if (retrievalTimestamp) {
                    if (itemCached._cacheUpdatedAt > retrievalTimestamp) {
                        return itemCached;
                    } else {
                        item._serv_timestamp = retrievalTimestamp;
                    }
            }

            if (itemInputClone._full === true && itemCached._full === false) {
                itemCached = itemInputClone;
            } else {
                itemCached = Object.assign({}, itemCached, itemInputClone);
            }

            itemCached._cacheUpdatedAt = new Date().getTime();
            itemCached._serv_updatedByMe = item._serv_updatedByMe;
            itemCached._cacheOutdated = Boolean(item._cacheOutdated);
            ASQ.deleteById(arrayCache, itemCached.id);
            arrayCache.push(itemCached);
            return itemCached; // as item of cache array
      }

      // Item is new
      itemInputClone._cacheUpdatedAt = new Date().getTime();
      itemInputClone._serv_timestamp = retrievalTimestamp;
      itemInputClone._cacheOutdated = false;
      arrayCache.push(itemInputClone);

      return itemInputClone;
   }


  updateItemsMetaCache(items: any[], updatingTime = null): T[] {
      const cachedItems: any[] = [];
      items.forEach((f) => {
          cachedItems.push(this.updateItemMetaCache(f, updatingTime));
      });

      return cachedItems;
  }

  /**
   * Search instances locally.
   * @param {string} qsearch - String to search in the object fields.
   * @param {number[]} scopeIds - Limiting search to specific collection of ids.
   * @return The cached items that matches the search input.
   * 
   */
  searchCache(qsearch: string, scopeIds: number[] = []) {
    let objects: any[];
    if (scopeIds.length) {
        objects = ASQ.getObjectbyIds(this.dataCached, scopeIds);
    } else {
        objects = [];
    }

    if (!qsearch) { return objects; }

    return objects.filter( obj => searchDeep(obj, qsearch));

  }


// --------------------------------------------------------------------------
// Methods to Cache Request Responses
// --------------------------------------------------------------------------

   /**
   * Delete short-lived server response cache. This data cache is only used for listing, common in pagination operations.
   */
  public resetListResponseCache() {
    this.cachedResponses = {};
  }

  private deleteOld(cache, age: number) {
      const now = new Date();
      for (const key in cache) {
          if ((now.getTime() - cache[key]['timestamp'].getTime()) / 1000 > age) {
              delete cache[key];
          }
      }
    }

  private cacheResponse(url, postData, response, cache) {
    if (this.disabledCache) {return cache};  
    const key = hashCode(url + JSON.stringify(postData));
    cache[key] = { response, timestamp: new Date() };

    return cache;
  }

  private getCachedResponse(url, postData, cache, age) {
    this.deleteOld(cache, age);
    const key = hashCode(url + JSON.stringify(postData));
    if (cache[key]) {
        return cache[key]['response'];
    }

    return null;
  }

  private cloneObj(obj:any): any{

    function simpleRecursiveClone(obj) {
      if ( obj.constructor === Array) {
        return  obj.map( v =>  (v && v.constructor === Object) ? simpleRecursiveClone(v) : v);
      }

      return Object.keys(obj).reduce((v, d) => Object.assign(v, {
        [d]: (obj[d] && obj[d].constructor === Object) ? simpleRecursiveClone(obj[d]) : obj[d]
      }), {});
    }

    switch (this.opt.mutationPreventionStrategy) {
      case 'simpleRecursiveClone':
        return simpleRecursiveClone(obj);
      case 'cloneDeep':
        return lodash.cloneDeep(obj);
      case 'jsonDeepCopy':
          return JSON.parse(JSON.stringify(obj));
      default:
        return obj
    }
  }



  private get_list_url(qsearch = '', pageRequest: DataPageRequest | null = null,  alternativeUrl='') {
    let url: string =  alternativeUrl ? alternativeUrl : this.url;
    let _preq: DataPageRequest = pageRequest ? pageRequest :  new DataPageRequest(); 
    let queryString  = '';
    qsearch = qsearch.trim();

    if (_preq.itemsPerPage) { queryString = queryString + `limit=${_preq.itemsPerPage}&`; }
    if (_preq.page) { queryString = queryString + `page=${_preq.page}&`; }
    if (_preq.orderBy) { queryString = queryString + `orderBy=${_preq.orderBy}&`; }
    if (qsearch) { queryString = queryString + `search=${qsearch}&`; }
    if (queryString)
      return `${url}/?${queryString}`;
    else
      return url;

  }
// --------------------------------------------------------------------------
// CRUD METHODS
// --------------------------------------------------------------------------
/**
 * Constructs a `GET` request that retrives a list of entity instances. In principle this method should be used to fetched non-nested or partial objects.
 * The fully nested object could be retrived in the detail view by using the method get().
 *
 * @param qsearch String query parameter: search string to be processed by the server.
 * @param pageRequest  Define the pagination properties. Example: { itemsPerPage: 50, page: 2, orderBy: 'last_name' } 
 * will be parsed to "http://my_url/?limit=50&page=2&orderBy=last_name&search=qsearch"
 * @param alternativeUrl  Alternative endpoint URL.
 * @see {@link get}
 *
 * @return An `Observable` of the response.
 */
    list(qsearch = '', pageRequest: DataPageRequest | null = null,  alternativeUrl='' ) {
        const url = this.get_list_url(qsearch, pageRequest, alternativeUrl);

        const cachedResponse = this.getCachedResponse(url, {}, this.cachedResponses, this.opt.serverResponseTTL);
        if (cachedResponse) {
          if (isObservable(cachedResponse)) {
            return (cachedResponse as Subject<any>);
          } else {
            return of(cachedResponse) as Subject<any>;
          }
        }

        return this.fetch({
            method: 'get',
            url: url,
        }).pipe(
            tap((rv: DataListResponse<T> | T[]) => this.cacheResponse(url, {}, rv, this.cachedResponses))
        );
    }

/**
 * This method constucts a `POST` request that retrives a list of selected entity instances.
 * The selecting parameters are passed in the request body through the parameter `options`. These parameters must be interpreted
 * by the backend.
 * In principle this method should be used in list views where the server would return non-nested or partial objects. 
 *
 * @param qsearch String query parameter: search string to be processed by the server.
 * @param pageRequest  Define the pagination properties. Example: { itemsPerPage: 50, page: 2, orderBy: 'last_name' } 
 * will be parsed to "http://my_url/?limit=50&page=2&orderBy=last_name&search=qsearch"
 * @param alternativeUrl  Alternative endpoint URL.
 * @param options  Selecting parameters passed to the server within the request body.
 * @see {@link list}
 * @return An `Observable` of the response.
 * @example 
 * ```
 * // Filtering
 *  let bakersList = [];
 *  const options = { filter: {'profession': 'Baker'}};
 *  service.advancedList('',  options)
 *  .subscribe( r => bakersList = r.list);
 * 
 * // Inclusion of instances
 *  let bakersListExtended = [];
 *  const options = { filter: {'profession': 'Baker'}, includeIds: [3, 4, 5]};
 *  service.advancedList('',  options)
 *  .subscribe( r => bakersListExtended = r.list);
 * 
 *  // Fully-nested objects
 *  let detailedBakersList = [];
 *  const options = { filter: {'profession': 'Baker'}, fullyNested: true};
 *  service.advancedList('',  options)
 *  .subscribe( r => detailedBakersList = r.list);
 * 
 *
 */
  advancedList(qsearch = '', pageRequest: DataPageRequest | null = null,   options: null | Partial<AdvancedListOptions>=null, alternativeUrl=''): Subject<DataListResponse <T>> {
        let advancedListEndPoint = alternativeUrl? alternativeUrl: this.opt.advancedListEndpoint;
        const defaultOptions = new AdvancedListOptions();
        let _opt = options ?  {...defaultOptions, ...options} : defaultOptions;

        
        const url = this.get_list_url(qsearch, pageRequest, advancedListEndPoint);

        let preCachedItems = ASQ.filterObjects(this.dataCached, { _cacheOutdated: false });
        const cachedItemsIds = preCachedItems.map(f => f.id);

        qsearch = qsearch.trim();
        if (qsearch && qsearch.length > 1) {
        let localSearchResults: any[];
        let searchResultsIds: number[];

        switch (_opt.searchScope) {
            case 'local':
                localSearchResults = this.searchCache(qsearch, cachedItemsIds);
                searchResultsIds = localSearchResults.map(f => f.id);
                if (_opt.filter['id__in']) {
                    _opt.filter['id__in'] = _opt.filter['id__in'].concat(searchResultsIds);
                } else {
                    _opt.filter['id__in']  = searchResultsIds;
                }
                break;

            case 'local+server':
                localSearchResults = this.searchCache(qsearch, cachedItemsIds);
                searchResultsIds = localSearchResults.map(f => f.id);
                _opt.includeIds = _opt.includeIds.concat(searchResultsIds)
                break;

            default:
                break;
        }
        }

        const postData = {cachedIds: cachedItemsIds, ..._opt};
        const cachedResponse = this.getCachedResponse(url, postData, this.cachedResponses, this.opt.serverResponseTTL);
        if (cachedResponse) {
        if (isObservable(cachedResponse)) {
            return (cachedResponse as Subject<any>);
        } else {
            return of(cachedResponse) as Subject<any>;
        }
        }

        const responseSubject =  new Subject <DataListResponse<T>> ();
        this.fetch({
                  method: 'post',
                  url,
                  data: postData
              })
              .pipe(
              tap((rv: DataListResponse<T>) => {
                  // CACHE REQUESTED DATA - LONG PERIOD
                  const freshCachedItems = this.updateItemsMetaCache(rv.list);
              }),
              map((rv: DataListResponse<T>) => {
                // CACHE REQUESTED DATA - LONG PERIOD
                if (rv.listIds) {
                  rv.list = this.cloneObj(ASQ.getObjectbyIds(this.dataCached, rv.listIds));
                }
                return rv;
              })
              ).subscribe(r => {
                  responseSubject.next(r);
                  responseSubject.complete();
              });

        // CACHE RESPONSE - SHORT PERIOD
        this.cacheResponse(url, postData, responseSubject, this.cachedResponses);
        return responseSubject;
  }

  /**
 * Constructs a `GET` request that retrieves the entity's fully nested data by its unique identifier (id) and saves it in the data cache, reducing the number of server accesses.
 * The default URL endpoint is used, appended by "/${id}/".
 *
 * If the property `setFullRecordOnGet` is set to `true`, the retrieved record will automatically receive an extra field `_full=true`, indicating that the record contains all fields and required nested fields.
 * This method will always request the server if the `_full` field of the record is set to `false`.
 *
 * @param id The unique identifier of the entity instance.
 * @param reload `false`: Get data from the local cache if available. `true`: Get data from the server and update the local cache.
 * @param alternativeUrl An alternative endpoint URL.
 *
 * @return An `Observable` of the service response.
 */
  get(id: string | number, reload: boolean = false, alternativeUrl = ''): Observable<T>  {
    let url: string;
      if (alternativeUrl === '') {
          url = urlJoin(this.url, `${id}`);
          url = this.opt.trailingSlash ? `${url}/`: `${url}`;
      } else {
          url = `${alternativeUrl}`;
      }

      let cached = ASQ.getObject(this.dataCached, { id });
      if (!cached) {cached = ASQ.getObject(this.dataCached, { _id: id }); }
      if (cached && !reload && !cached._cacheOutdated && cached._full) {
            const cachedCloned =lodash.cloneDeep(cached);
            return of(cachedCloned as T);
      }

      return this.fetch({
          url: url,
          method: 'get',
      })
      .pipe(
          map((response: T) => {
            if (this.setFullRecordOnGet) { response['_full'] = true; }
            const r = this.updateItemMetaCache(response, new Date().getTime());
            const cachedCloned = lodash.cloneDeep(r);
            return cachedCloned;
          })
      );
  }


/**
 * Constructs a `POST` request to create a new entity record in the server database.
 *
 * @param instance partial instance of object. 
 *
 * @return An `Observable` of the response. If the server response includes the data of the created record, this data will be cached.
 */
  create(instance: Partial<T>): Observable<DataCreationResponse<T>> {
    return this.fetch({
        url: `${this.url}`,
        method: 'post',
        data: this.serializer(instance),
    })
        .pipe(
          tap((r: any) => {
            if (r.instances) {
                r.instances.forEach(i => i._serv_updatedByMe = true);
                this.updateItemsMetaCache(r.instances);
            } else {
                if (r.instance) {
                    instance['_serv_updatedByMe'] = true;
                    this.updateItemMetaCache({...instance, ...r.instance});
                } else {
                    instance['id'] = r.id;
                    this.updateItemMetaCache(lodash.cloneDeep(instance));
                }
            }
            this.resetListResponseCache();
          })
        );
    }

  
  /**
 * Constructs a `PATCH` request to update an existing instance in the server database.
 *
 * @param instance partial record of object. 
 *
 * @return An `Observable` of the response. If the server response includes the data of the created instance, this data will update the cache.
 */
    edit(instance: Partial<T>, alternativeUrl = '') {
      let url: string;
      if (alternativeUrl === '') {
          url = this.opt.trailingSlash ? `${this.url}${instance['id']}/`: `${this.url}${instance['id']}`;
      } else {
          url = `${alternativeUrl}`;
      }

      const data = this.serializer(instance);
      const editObservable = this.fetch({
          url: `${url}`,
          method: 'patch',
          data
          })
          .pipe(
            tap((r: any) => {
              instance['_serv_updatedByMe'] = true;
              if (r.instance) {
                  this.updateItemMetaCache({...instance, ...r.instance});
              } else {
                  this.updateItemMetaCache({...instance});
              }
              this.resetListResponseCache();

            })
          );

      this.cacheResponse(url, data, editObservable, this.cachedPUT);
      return editObservable;
  }


  /**
 * Constructs a `PATCH` request to update an existing record in the server database.
 *
 * @param id Unique identifier of the entity record.
 *
 * @return An `Observable` of the response. If the server response includes the data of the created record, this data will update the cache.
 */
  delete(id: number | DataModel, alternativeUrl = '') {
      let ID = id;
      if (typeof(id) === 'object') {
          ID = id['id'];
      }

      const url = this.opt.trailingSlash ? `${this.url}${ID}/`: `${this.url}${ID}`;

      return this.fetch({
          url: url,
          method: 'delete',
          data: {}
      })
      .pipe(
        tap((r) => {
          ASQ.deleteObjects(this.dataCached, { id: ID });
          this.resetListResponseCache();
        })
      );
  }

}

