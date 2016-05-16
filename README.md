# Distributed key-value database inspired by Amazon Dynamo

Implementation of a course assignment: Distributed program systems @ FIIT

**Contributors:**
- Patrik Gallik
- Viktor Vinczler
- Erik Grman

**Implemented Dynamo features:**
- chord & consistent hashing
- vector clock
- fault tolerance
- replication
- sloppy quorum
- REST API

**Infrastructure Features**
- multihost config
- service discovery + health checking - consul, registrator
- proxy
	- nginx - loadbalancer
	- consul-template - reconfiguration
- distributed logging and business monitoring
	- filebeat - log forwarding
	- logstash - log processor
	- elasticsearch - repository
	- kibana - graphical dashboard

## How to setup environment

**Prerequisites**

1. Virtual Host with Linux running on bridged network (in case of multiple hosts)
2. Installed and running **docker**
3. Installed **docker-compose**

**sudo pass**

```
a123456
```

### Repository

Clone this repository into /workspace
1. Start Terminal
2. Type following

```bash
mkdir -p /workspace
cd /workspace
git clone https://github.com/patresk/node-amazon-dynamo.git
```

### Running application

#### ELK stack

**Configuration location**

```bash
/workspace/node-amazon-dynamo/docker/elk/config
```

**Running**

```bash
docker-compose -f /workspace/node-amazon-dynamo/docker/elk/elk.yml up
```
Import visualization to Kibana from 

```bash
/workspace/node-amazon-dynamo/docker/elk/config/kibanaExport.json
```

#### MASTER NODE: loadbalancer + consul(master) + registrator + application

Edit run config for master node:

```bash
ifconfig eth0 | grep "inet addr"			#outputs something like: inet addr:192.168.1.10  Bcast:192.168.1.255  Mask:255.255.255.0
subl /workspace/node-amazon-dynamo/docker/master.yml
#Edit line: command: -server -bootstrap -advertise 192.168.1.10
#Use "inet addr" from previous command for -advertise
```

**Running**

```bash
docker-compose -f /workspace/node-amazon-dynamo/docker/master.yml up
```

#### Other nodes: consul + registrator + application

Edit run config on each other node:

```bash
ifconfig eth0 | grep "inet addr"			#outputs something like: inet addr:192.168.1.9  Bcast:192.168.1.255  Mask:255.255.255.0
subl /workspace/node-amazon-dynamo/docker/node.yml
#Edit line: command: -server -advertise 192.168.1.9 -join 192.168.1.10
#Use "inet addr" from previous command for -advertise and "inet addr" of master node for -join
```

**Running**

```bash
docker-compose -f /workspace/node-amazon-dynamo/docker/node.yml up
```

## Dynamo implementation

### REST API

Following REST endpoints ensures Dynamo functionality.
Always use `application/json` Content-Type header.
Each endpoint has `quorum` *query* parameter (not in body!), e.g. `GET /v1/:key?quorum=3`. If quorum value provided is higher then replicas number, replicas number is used as quorum.

#### GET /v1/:key
**Parameters:** none
**Response:**
```
{
  "value": [ "Luke Skywalker" ],
  "clock": "eyIxOTIuMTY4Ljk5LjEwMDozMzAwMSI6MX0="
}
```
#### POST /v1/:key
**Parameters:** 
* `value` - required
```
{ "value": "Luke Skywalker" }
```
**Response:**
```
{ "message": <text> }
```
#### PUT /v1/:key
**Parameters:**
* `value` - required
* `clock` - required
```
{ 
  "value": "Luke Skywalker",
  "clock": "eyIxOTIuMTY4Ljk5LjEwMDozMzAwMSI6MX0="
}
```
**Response:**
```
{ "message": <text> }
```
#### DELETE /v1/:key
**Parameters**: none
**Response:**
```
{ "message": <text> }
```

### Described use cases

#### New node is added to the network

A node that is added to the network, performs following steps:

* 1. Sets its state to NEW
* 2. Check if there are some nodes in PENDING state. If yes, waits random time and tries again step 2.
* 3. If there are no PENDING nodes, the node checks if there are other nodes with NEW state. These nodes are ordered by hostname, and the first one node is allowed to continue. If the current node is not allowed, waits random time and goes to step 2.
* 4. Send requests to all nodes to add itself to hashring. All nodes sent response with predicted new hash ring. If all predicted hashrings are the same, the node sends requests again, and it is added to the hashring. The node changes its state to PENDING
* 5. The node sends requests to responsible nodes it should copy data from -> keys in its address space and backups for other nodes
* 6. If copying data is done, node changes its state to READY

#### Incoming request via public api

Node that receives the request via any public endpoint above is becoming the coordinator of the request and is responsible to send response to the user. The coordinator performs following steps:

* 1. Hash the key and get the position of the key in the hashring
* 2. Sends requests to the node responsible for the node + to backups node
* 3, When quorum is fullfilled, sends reponse to the user

## How to dev

Tests can be run on host machine
```
# assumes `npm install`
npm test
```

**Structure**
- `src/server.js` - contains public and internal API 
- `src/discovery.js` - node lifecycle, coordination
- `src/util.js` - helpers to add/remove nodes from hashring, vector clock helpers
- `src/logger.js` - logger wrapper
- `src/store.js` - store implementation, when all data (with backups) are stored
- `src/config.js` - configuration
