/**
 * Created by kizer on 17/07/2017.
 */
import * as nconf from 'nconf';

nconf
    .argv()
    .env()
    .file({file: __dirname + '/cfg.json'});


export default nconf;
