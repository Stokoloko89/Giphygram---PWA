// SW Version
const version = "1.1";

// Static Cache - App Shell - static assets that will be cached
const appAssests = [
  "index.html",
  "main.js",
  "images/flame.png",
  "images/logo.png",
  "images/sync.png",
  "vendor/bootstrap.min.css",
  "vendor/jquery.min.js",
];

// SW Install Listener
self.addEventListener("install", (e) => {
  e.waitUntil(
    // we create a new cache store for our service worker
    caches
      .open(`static-${version}`)
      // then once the cache has been created, add all the 'appAssests' above to it
      .then((cache) => cache.addAll(appAssests))
  );
});

// SW Activate
self.addEventListener("activate", (e) => {
  // First we clean any old version of the static cache
  // The variable 'cleaned' is the final promise which we will have the event (e) wait.
  let cleaned = caches.keys().then((keys) => {
    keys.forEach((key) => {
      // so if the key is not equal to the current cache name but does match 'static-' which means it is the outdated version of the static cache then delete it
      if (key !== `static-${version}` && key.match("static-")) {
        // so it return the promise of the deleted previous version of the static cache
        return caches.delete(key);
      }
    });
  });

  e.waitUntil(cleaned);
});

// Caching strategy - fetch from Cache with Network Fallback - got to Cache, if not there, then go to the network, and add it to the cache for any subsequent requests.
const staticCache = (req, cacheName = `static-${version}`) => {
  return caches.match(req).then((cachedReq) => {
    // Return cached response if found
    if (cachedReq) return cachedReq;

    // Fallback to network - call the network.
    return fetch(req).then((networkRes) => {
      // Updated the cache with network response
      caches.open(cacheName).then((cache) => cache.put(req, networkRes));

      // Return clone of network response
      return networkRes.clone();
    });
  });
};

// Caching strategy for Giphy - Network with Cache Fallback - we update the cache each time the update succeeds on the network
const fallbackCache = (req) => {
  // Try the network first
  return (
    fetch(req)
      .then((networkRes) => {
        if (!networkRes.ok) throw "Fetch Error";

        //   Update the cache with the network response
        caches
          .open(`static-${version}`)
          .then((cache) => cache.put(req, networkRes));

        //   Return clone of network response
        return networkRes.clone();
      })

      // If the network fails, try the cache
      .catch((err) => caches.match(req))
  );
};

//   Clean old Giphys from the 'giphy' cache
const cleanGiphyCache = (giphys) => {
  // First get all the giphys in the cache
  caches.open("giphy").then((cache) => {
    // Then we get the keys of the giphys
    cache.keys().then((keys) => {
      // Then we loop through the keys and delete the ones that are not part of the current Giphys array
      keys.forEach((key) => {
        if (!giphys.includes(key.url)) {
          cache.delete(key);
        }
      });
    });
  });
};

// SW Fetch

// Static Cache - (This ensures that we serve the App Shell from the cache)
self.addEventListener("fetch", (e) => {
  // App Shell - we want to identify the fetch as a local static or app resource request then we attempt to serve it from the cache.
  if (e.request.url.match(location.origin)) {
    e.respondWith(staticCache(e.request));

    // Dynamic Cache - (we serve the giphy files from the network)

    // Giphy API - here we want to retrieve the network giphy.
  } else if (e.request.url.match("api.giphy.com/v1/gifs/trending")) {
    e.respondWith(fallbackCache(e.request));

    // Giphy Media - this is the media files for the giphy.
  } else if (e.request.url.match("giphy.com/media/")) {
    // To ensure that we don't lose our Gifs when updating the service worker, we pass a second argument specifying a different cache to use to the static cache function.
    e.respondWith(staticCache(e.request, "giphy"));
  }
});

// Listen for messages from the client
self.addEventListener("message", (e) => {
  // If the message is from the client and it is a message type of 'cleanGiphyCache' then we clean the giphy cache
  if (e.data.action === "cleanGiphyCache") cleanGiphyCache(e.data.giphys);
});
