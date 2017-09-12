
import { readFileSync, watch } from 'fs';
import * as debug from 'debug';
import * as e from 'express';

const logger = debug('waend:routes/renderers');


const scriptContent =
    (fp: string) => {
        const initialScript = readFileSync(fp);
        const versions = [initialScript];

        watch(fp, (event) => {
            if (event === 'change') {
                versions.push(readFileSync(fp));
                logger(`loaded renderer [${fp}][${versions.length}]`);
            }
        });

        return ((_request: e.Request) => {
            const bundle = versions[versions.length - 1];
            return bundle;
        });
    };


const configure =
    (renderers: string[], router: e.Router) => {

        renderers.forEach((fp, idx) => {
            logger('loading', fp);
            const script = scriptContent(fp);

            router.get(`/render/${idx}.js`,
                (request, response) => response.send(script(request)));
        });
    };

export default configure;

logger('loaded');
