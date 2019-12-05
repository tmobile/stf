all: node_modules package-lock.json res/build res/bower_components

node_modules: package.json
	PATH=/usr/local/opt/node@8/bin/:$(PATH) /usr/local/opt/node@8/bin/npm install

package-lock.json: node_modules
	/usr/bin/true

res/build: res/bower_components havegulp
	gulp build

res/bower_components: havebower
	bower install
	touch res/bower_components

havegulp:
	@if [ "$(which gulp 2>/dev/null)"=="" ]; then npm install --global gulp; fi;
	touch havegulp

havebower:
	@if [ "$(which bower 2>/dev/null)"=="" ]; then npm install --global bower; fi;
	touch havebower

docker:
	docker build -t stf_with_ios:1.0

clean:
	$(RM) package-lock.json
	$(RM) -rf node_modules
	$(RM) -rf res/build
	$(RM) -rf res/bower_components