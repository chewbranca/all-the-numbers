# all-the-numbers

CouchDB View Server Benchmarking Suite

## Goals

To establish a baseline set of metrics for comparing various view engines. The
benchmark is designed to do an "end to end" benchmark of the views, testing the
total time it takes for the view engine to process the docs and get the data
saved to disk in CouchDB. The motivation for this is to get a relatively
accurate look at external view engine performance compared to the native erlang
view engine.

Additionally, the results should be saved for easy comparisons and analysis. This will currently save results into http://localhost:5984/all\_the\_numbers\_results.

Ideally this tool will be comprehensive in covering the various view engines and provide simple config examples required to run benchmarks locally against all view engines.

Initial benchmarks that come to mind:

    * Base SpiderMonkey view engine
    * Jason's direct node.js port
    * Native Erlang view engine (how much does serializing to external services really cost)
    * Things along the lines of erlv8
    * Anything else

## Status

This is currently a rough benchmark I threw together today. Hopefully we can
get feedback on a comprehensive suite of view tests to accurately guage
relative performance. Various settings are currently hardcoded in bench.js.

## Install and Run

    npm install

    node bench.js

## Config

    ; Default view engine
    ; [query_servers]
    ; javascript = /usr/local/bin/couchjs /usr/local/share/couchdb/server/main.js

## Contributing

Please!

Fork this repo, add a ddoc for your view engine to the ddocs var, and update the config values in the README for your particular engine. Ideally each additional view engine should be properly namespaced so that all view engines can be easily tested against. For instance, different languages could be "javascript," "javascri\_node.js," "javascript\_v8\_experiments," "some\_other\_view\_engine."

## License

Apache License Version 2.0