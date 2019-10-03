FROM ubuntu:18.04

# Sneak the stf executable into $PATH.
ENV PATH /app/bin:$PATH

# Work in app dir by default.
WORKDIR /app

# Export default app port, not enough for all processes but it should do
# for now.
EXPOSE 3000

RUN apt-get update && \
    apt-get -y install curl wget python build-essential libxml-bare-perl libzmq3-dev libprotobuf-dev git graphicsmagick yasm&& \
    curl -sL -o /tmp/install_node.sh https://deb.nodesource.com/setup_8.x && \
    chmod +x /tmp/install_node.sh && \
    /tmp/install_node.sh && \
    apt install -y nodejs && \
    rm -rf /tmp/install_node.sh

# Install app requirements. Trying to optimize push speed for dependant apps
# by reducing layers as much as possible. Note that one of the final steps
# installs development files for node-gyp so that npm install won't have to
# wait for them on the first native module installation.
RUN export DEBIAN_FRONTEND=noninteractive && \
    useradd --system \
      --create-home \
      --shell /usr/sbin/nologin \
      stf-build && \
    useradd --system \
      --create-home \
      --shell /usr/sbin/nologin \
      stf && \
    cd /tmp && \
    su stf-build -s /bin/bash -c '/usr/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js install' && \
    apt-get clean && \
    rm -rf /var/cache/apt/* /var/lib/apt/lists/*

# Just copy package.json and package-lock.json
COPY ./package*.json /tmp/build/

# Give permissions to our build user.
RUN mkdir -p /app && \
    chown -R stf-build:stf-build /tmp/build /app

# Switch over to the build user.
USER stf-build

# Install just the package dependencies before copying in the full source
RUN set -x && \
    cd /tmp/build && \
    export PATH=$PWD/node_modules/.bin:$PATH && \
    npm install --loglevel http

# Just copy bower.json
COPY --chown=stf-build:stf-build ./bower.json /tmp/build/

# Bower install
RUN set -x && \
    cd /tmp/build && \
    export PATH=$PWD/node_modules/.bin:$PATH && \
    bower install && \
    bower cache clean

# Copy the rest of the app source in
COPY --chown=stf-build:stf-build . /tmp/build/

# Package and cleanup
RUN set -x && \
    cd /tmp/build && \
    export PATH=$PWD/node_modules/.bin:$PATH && \
    npm pack && \
    tar xf stf-*.tgz --strip-components 1 -C /app && \
    npm prune --production && \
    mv node_modules /app && \
    npm cache clean --force&& \
    rm -rf ~/.node-gyp && \
    cd /app && \
    rm -rf /tmp/*
    
# Switch to the app user.
USER stf

# Show help by default.
CMD stf --help
