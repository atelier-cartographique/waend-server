
import { readFileSync, watch } from 'fs';
import * as debug from 'debug';
import * as e from 'express';
import { JSDOM } from 'jsdom';

// interface WaendApplication {
//     name: string;
//     version: string;
//     application: string;
//     styleDir?: string;
// }

const logger = debug('waend:routes/applications');

const renderIndex =
    (app: any) => {
        const dom = new JSDOM('<!DOCTYPE html>');
        const doc = dom.window.document;
        const head = doc.head;
        const title = doc.createElement('title');
        const metaViewport = doc.createElement('meta');
        const style = doc.createElement('link');
        const localScript = doc.createElement('script');
        const script = doc.createElement('script');
        const { name, version } = app;
        const fullName = `${name}-${version}`;

        title.appendChild(doc.createTextNode(`wænd ${name}`));
        head.appendChild(title);

        metaViewport.setAttribute('name', 'viewport');
        metaViewport.setAttribute('content', 'width=device-width, height=device-height, initial-scale=1, maximum-scale=1');
        head.appendChild(metaViewport);

        style.setAttribute('rel', 'stylesheet');
        style.setAttribute('type', 'text/css');
        style.setAttribute('href', `/style/${fullName}/style.css`);
        head.appendChild(style);

        localScript.appendChild(doc.createTextNode(`
        window.FRAGMENT_ROOT = '/${name}/';
        `));
        head.appendChild(localScript);

        script.setAttribute('src', `/bin/${fullName}.js`);
        head.appendChild(script);

        return dom.serialize();
    };

const scriptContent =
    (fp: string) => {
        const initialScript = readFileSync(fp);
        const versions = [initialScript];

        watch(fp, (event) => {
            if (event === 'change') {
                versions.push(readFileSync(fp));
                logger(`loaded script [${fp}][${versions.length}]`);
            }
        });

        return (() => versions[versions.length - 1]);
    };


const configure =
    (apps: any[] /* WaendApplication[] */, router: e.Router) => {

        const routes: string[] = [];

        apps.forEach((app, _idx) => {
            const { name, version } = app;
            logger('loading', name, version);
            const fullName = `${name}-${version}`;
            const index = renderIndex(app);
            const script = scriptContent(app.application);

            router.get(`/${name}*`,
                (_request, response) => response.send(index));
            router.get(`/bin/${fullName}.js`,
                (_request, response) => response.send(script()));

            if (app.styleDir) {
                const styleService = e.static(app.styleDir);
                logger(`style@${app.styleDir}`);
                router.use(`/style/${fullName}/`, styleService);
            }

            routes.push(`/${name}`);

            // if (idx === 0) {
            //     router.get('/', (_req, res) => {
            //         res.redirect('/${name}');
            //     });
            // }
        });

        router.get('/',
            (_req, res) => {
                const dom = new JSDOM('<!DOCTYPE html>');
                const doc = dom.window.document;
                routes.forEach((r) => {
                    const elem = doc.createElement('div');
                    const a = doc.createElement('a');

                    a.setAttribute('href', r);
                    a.appendChild(doc.createTextNode(r));
                    elem.appendChild(a);
                    doc.body.appendChild(elem);
                });

                res.send(dom.serialize());
            });
    };

export default configure;

logger('loaded');
