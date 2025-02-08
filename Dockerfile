FROM langchain/langgraphjs-api:20
ADD . /deps/open-canvas
ENV LANGSERVE_GRAPHS='{"agent":"./src/agent/open-canvas/index.ts:graph","reflection":"./src/agent/reflection/index.ts:graph","thread_title":"./src/agent/thread-title/index.ts:graph"}'
WORKDIR /deps/open-canvas
RUN yarn install
RUN (test ! -f /api/langgraph_api/js/build.mts && echo "Prebuild script not found, skipping") || tsx /api/langgraph_api/js/build.mts