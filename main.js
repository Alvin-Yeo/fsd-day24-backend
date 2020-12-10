// load libraries
const express = require('express');
const secureEnv = require('secure-env');
const cors = require('cors');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const multer = require('multer');
const multerS3 = require('multer-s3');

// environment configuration
global.env = secureEnv({ secret: 'isasecret' });
const APP_PORT =  parseInt(process.argv[2]) || global.env.APP_PORT || 3000;

// configure AWS S3
AWS.config.credentials = new AWS.SharedIniFileCredentials({ profile: 'fsd-day24' });
const s3 = new AWS.S3({
    endpoint: new AWS.Endpoint('sfo2.digitaloceanspaces.com')
});

// upload file to s3
const uploadFile = multer({
    storage: multerS3({
        s3: s3,
        bucket: 'fsd-day24',
        acl: 'public-read',
        metadata: function(req, file, cb) {
            cb(null, {
                fieldName: file.fieldname,
                originalFileName: file.originalname,
                mediaType: file.mimetype,
                // fileSize: file.size,
                uploadedAt: new Date().toString(),
                uploadedBy: req.body.uploader || 'defaultUploader',
                note: req.body.remark || ''
            });
        },
        key: function(req, file, cb) {
            cb(null, new Date().getTime().toString().concat('-').concat(file.originalname));
        }
    })
});

// create an instance of express
const app = express();

// resources
app.use(cors());
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(bodyParser.json({ limit: '50mb' }));

// POST /upload
app.post('/upload', uploadFile.array('file', 1), (req, res) => {
    console.info('[INFO] File is uploaded successfully.');
    res.status(200);
    res.type('application/json');
    res.json({ 
        status: 'File is uploaded successfully.',
        file: res.req.files
    });
});

// GET /blob/:key
app.get('/blob/:key', async(req, res) => {
    const key = req.params.key;

    const params = {
        Bucket: 'fsd-day24',
        Key: key
    };

    const headObjectResp = await s3.headObject(params).promise();
    
    if(headObjectResp) {
        res.set({
            'X-Original-Name': headObjectResp.Metadata.originalfilename,
            'X-Create-Time': headObjectResp.Metadata.uploadedat,
            'X-Uploader': headObjectResp.Metadata.uploadedby,
            'X-Notes': headObjectResp.Metadata.note
        });

        s3.getObject(params, (err, data) => {
            if(err) {
                res.status(404);
                res.type('application/json');
                res.json({ status: 'Error 404. Image not found.' });
            }
            
            res.status(200);
            res.type(data.Metadata.mediatype);
            res.send(data.Body);
            // res.type('application/json');
            // res.json({ status: 'Image retrieved from database successfully.' });
        });
    } else {
        res.status(404);
        res.type('application/json');
        res.json({ status: 'Error 404. Image not found.' });
    }
});

// start server
app.listen(APP_PORT, () => {
    console.info(`[INFO] Application started on port ${APP_PORT} on ${new Date()}`);
});