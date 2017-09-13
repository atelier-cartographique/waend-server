
import * as e from 'express';

const configure =
    (fd: string, router: e.Router) => {
        const fontService = e.static(fd);
        router.use(`/fonts/`, fontService);
    };

export default configure;
