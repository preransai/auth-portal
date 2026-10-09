const path = require('path');
const express = require('express');
const session = require('express-session');
const { MongoStore } = require('connect-mongo');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const csrfProtection = require('./middleware/csrf');
const flash = require('./middleware/flash');
const rejectNonStringInput = require('./middleware/sanitize');
const { loadUser } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');
const format = require('./utils/format');
const routes = require('./routes');

function createApp({ mongoClient }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  Object.assign(app.locals, format, {
    appName: config.appName,
    security: config.security,
    devMailbox: config.mail.devMailbox
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          ...(config.isProd && { upgradeInsecureRequests: [] })
        }
      },
      strictTransportSecurity: config.isProd
    })
  );

  if (!config.isTest) app.use(morgan(config.isProd ? 'combined' : 'dev'));

  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProd ? '7d' : 0 }));

  app.use(express.urlencoded({ extended: false, limit: '10kb', parameterLimit: 50 }));
  app.use(express.json({ limit: '10kb' }));
  app.use(rejectNonStringInput);

  // Server-side sessions rather than JWTs: the app renders HTML on the same
  // origin, and with sessions in MongoDB a logout or password change really
  // ends access instead of waiting for a token to expire.
  app.use(
    session({
      name: config.session.name,
      secret: config.session.secret,
      resave: false,
      saveUninitialized: false,
      store: MongoStore.create({
        client: mongoClient,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60,
        touchAfter: 10 * 60
      }),
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProd
      }
    })
  );

  app.use(flash);
  app.use(csrfProtection);
  app.use(loadUser);
  app.use((req, res, next) => {
    res.locals.currentPath = req.path;
    next();
  });

  app.use(routes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
