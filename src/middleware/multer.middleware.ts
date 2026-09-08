import multer from 'multer';

const upload = multer({ dest: 'src/public/data/uploads/' });

export default upload;
