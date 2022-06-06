import { AdvancedListOptions, DataCreationResponse, DataListResponse, DataModel, DataPageRequest, FetchOptions } from './api-data-cache.models';
import { isObservable, map, Observable, of, Subject, tap } from 'rxjs';
import * as ASQ from 'array-simple-query';
import * as lodash from 'lodash';
import { hashCode, searchDeep } from './utils';

export * from './api-data-cache.models';

export interface HttpClientProxy {
    get:  (...params) => Observable <any>; 
    put:  (...params) => Observable <any>; 
    patch:  (...params) => Observable <any>; 
    post: (...params) => Observable <any>; 
    request: (...params) => Observable <any>; 
}


export class ApiDataCacheService <T> {
  public url: string;
  public started: boolean = false;
  public trailingSlash: boolean = false;

  // Function to serialize the instance data before sending to server
  public serializer: (data) => { }; 

  // Data cache properties
  private cachedResponses = {};
  private cachedPUT = {};
  private dataCached: T[] = [];
  public cachedVersionInfo: { [id: string]: any[]} = {};
  private httpProxy: HttpClientProxy;

//   Expiration for Response Caching
  public maxCachedListAge = 5; // seconds

// Expiration for Data Caching
  public maxCachedGetAge = 100; // seconds    



  constructor(http: any) {   // Expiration for Data Caching
        this.httpProxy = http as HttpClientProxy;
    }

  // suggar around $http
  private fetch<T>(options: FetchOptions): Observable <any> {     
    const method = options.method.toLowerCase();
    switch (method) {
      case 'get':
        return this.httpProxy.get(`${options.url}`);
      case 'put':
        return this.httpProxy.put(`${options.url}`, options.data);
      case 'patch':
        return this.httpProxy.patch(`${options.url}`, options.data);
      case 'post':
        return this.httpProxy.post(`${options.url}`, options.data);
      case 'delete':
        return this.httpProxy.request('delete', `${options.url}`, { body: options.data });
      default:
        return this.httpProxy.get(`${options.url}`);;
    }
  
  }


    // --------------------------------------------------------------------------
    // Methods to Cache the Entity Data
    // --------------------------------------------------------------------------

    initiateService() { }

    markAllOutdated() {
        this.dataCached.forEach(d => d['_cacheOutdated'] = true);
    }

    markOutdated(id: number | string) {
        const itemCached = ASQ.getObject(this.dataCached, { id: id });
        itemCached['_cacheOutdated'] = true;
    }

    updateItemMetaCache(item, retrievalTimestamp: number | null = null): any {
        this.cachedVersionInfo[item.id] = [];
        if (typeof (item) !== 'object') { return null; }
        const arrayCache = this.dataCached;

        // Add stamp to urls to force browser pull the new img from server
        for (const attribute in item) {
            if (typeof(item[attribute]) === 'string' && item[attribute].startsWith('/api/')) {
                item[attribute] += `?${new Date().getTime()}`;
            }
        }

        const itemInputClone = lodash.cloneDeep(item);
        let itemCached = ASQ.getObject(arrayCache, { id: item.id });
        if (itemCached) {
            if (retrievalTimestamp) {
                    if (itemCached._cacheUpdatedAt > retrievalTimestamp) {
                        return itemCached;
                    } else {
                        item._serv_timestamp = retrievalTimestamp;
                    }
            }
            itemInputClone._cacheUpdatedAt = new Date().getTime();

            if (itemInputClone.full === true && itemCached.full === false) {
                itemCached = itemInputClone;
            } else {
                itemCached = Object.assign({}, itemCached, itemInputClone);
            }
            itemCached._serv_updatedByMe = item._serv_updatedByMe;
            itemCached._cacheOutdated = !!item._cacheOutdated;
            itemCached['id'] = parseInt(itemCached['id'], 10);

            ASQ.deleteById(arrayCache, itemCached.id);
            arrayCache.push(itemCached);
            return itemCached; // as item of cache array
        }
        item._cacheUpdatedAt = new Date().getTime();
        item._serv_timestamp = retrievalTimestamp;
        item._cacheOutdated = false;
        const itemOfCacheArray = itemInputClone;
        arrayCache.push(itemOfCacheArray);

        return itemOfCacheArray;
   }


  updateItemsMetaCache(items: any[], updatingTime = null): T[] {
      const cachedItems: any[] = [];
      items.forEach((f) => {
          cachedItems.push(this.updateItemMetaCache(f, updatingTime));
      });

      return cachedItems;
  }


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

  resetListResponseCache() {
    this.cachedResponses = {};
  }

  public deleteOld(cache, age: number) {
      const now = new Date();
      for (const key in cache) {
          if ((now.getTime() - cache[key]['timestamp'].getTime()) / 1000 > age) {
              delete cache[key];
          }
      }
    }

    private cacheResponse(url, postData, response, cache) {
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



  private get_list_url(qsearch = '', pageRequest: DataPageRequest | null = null,  alternativeUrl='') {
    let url: string =  alternativeUrl ? alternativeUrl : this.url;
    let _preq: DataPageRequest = pageRequest ? pageRequest :  new DataPageRequest(); 
    qsearch = qsearch.trim();
    return `${url}/?limit=${_preq.itemsPerPage}&page=${_preq.page}&orderBy=${_preq.orderBy}&search=${qsearch}`;

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

        const cachedResponse = this.getCachedResponse(url, {}, this.cachedResponses, this.maxCachedListAge);
        if (cachedResponse) {
          if (isObservable(cachedResponse)) {
            return (cachedResponse as Subject<any>);
          } else {
            return of(cachedResponse) as Subject<any>;
          }
        }

        return this.fetch({
            method: 'get',
            url: this.url,
        }).pipe(
            tap((rv: DataListResponse<T> | T[]) => this.cacheResponse(url, {}, rv, this.cachedResponses))
        );
    }

/**
 * This method constucts a `POST` request that retrive a list of selected entity instances.
 * The selecting parameters are passed in the request body through `options`. These parameters must be interpreted
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
 *  service.advancedList('', null, options)
 *  .subscribe( r => bakersList = r.list);
 * 
 * // Inclusion of instances
 *  let bakersListExtended = [];
 *  const options = { filter: {'profession': 'Baker'}, includeIds: [3, 4, 5]};
 *  service.advancedList('', null, options)
 *  .subscribe( r => bakersListExtended = r.list);
 * 
 *  // Fully-nested objects
 *  let detailedBakersList = [];
 *  const options = { filter: {'profession': 'Baker'}, fullyNested: true};
 *  service.advancedList('', null, options)
 *  .subscribe( r => detailedBakersList = r.list);
 * 
 *
 */
  advancedList(qsearch = '', pageRequest: DataPageRequest | null = null,  alternativeUrl='', options: AdvancedListOptions=null): Subject<DataListResponse <T>> {
        const url = this.get_list_url(qsearch, pageRequest, alternativeUrl);

        let _opt = options ?  options : new AdvancedListOptions();
        let cachedItems = ASQ.filterObjects(this.dataCached, { _cacheOutdated: false });
        const cachedItemsIds = cachedItems.map(f => f.id);

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

        const postData = {cachedIds: cachedItemsIds, ...options};
        const cachedResponse = this.getCachedResponse(url, postData, this.cachedResponses, this.maxCachedListAge);
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
        map((rv: DataListResponse<T>) => {
            // CACHE REQUESTED DATA - LONG PERIOD
            const freshCachedItems = this.updateItemsMetaCache(rv.list);
            return {...rv, list: freshCachedItems};
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
 * Constructs a `GET` request that retrive then entity fully nested data by id. It uses the default url endpoint
 * appended by "/${id}/"
 *
 * @param id Unique identifier of the entity instance.
 * @param reload  False: get data from local cache, if available. True: get data from server and  update local cache.
 * @param alternativeUrl  Alternative endpoint URL.
 *
 *
 * @return An `Observable` of the response.
 */
  get(id: string | number, reload: boolean = false, alternativeUrl = ''): Observable<T>  {
    let url: string;
      if (alternativeUrl === '') {
          url = this.trailingSlash ? `${this.url}${id}/`: `${this.url}${id}`;

      } else {
          url = `${alternativeUrl}`;
      }

      let cached = ASQ.getObject(this.dataCached, { id });
      if (!cached) {cached = ASQ.getObject(this.dataCached, { _id: id }); }
      if (cached && !reload && !cached._cacheOutdated && cached.full) {
            const cachedCloned = {};
            for (const key in cached) {
                if (key === 'data') {
                    cachedCloned['data'] = cached.data;
                } else {
                    cachedCloned[key] = lodash.cloneDeep(cached[key]);
                }
            }

            return of(cachedCloned as T);
      }

      return this.fetch({
          url: url,
          method: 'get',
      })
          .pipe(
              map((response: T) => {
                  if (response['id'].toString() !== id.toString()) { response['_id'] = id; }
                  const r = this.updateItemMetaCache(response, new Date().getTime());
                  const cachedCloned = lodash.cloneDeep(r);
                  return cachedCloned;
              })
          );
  }


/**
 * Constructs a `POST` request to create an new entity instance in the server database.
 *
 * @param instance partial instance of object. 
 *
 * @return An `Observable` of the response. If the server response includes the data of the created instance, this data will be cached.
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
 * @param instance partial instance of object. 
 *
 * @return An `Observable` of the response. If the server response includes the data of the created instance, this data will update the cache.
 */
    edit(instance: Partial<T>, alternativeUrl = '') {
      let url: string;
      if (alternativeUrl === '') {
          url = this.trailingSlash ? `${this.url}${instance['id']}/`: `${this.url}${instance['id']}`;
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
 * Constructs a `PATCH` request to update an existing instance in the server database.
 *
 * @param id Unique identifier of the entity instance.
 *
 * @return An `Observable` of the response. If the server response includes the data of the created instance, this data will update the cache.
 */
  delete(id: number | DataModel, alternativeUrl = '') {
      let ID = id;
      if (typeof(id) === 'object') {
          ID = id['id'];
      }

      const url = this.trailingSlash ? `${this.url}${ID}/`: `${this.url}${ID}`;

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

