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

## VirtualBox image

**Prerequisites**

1. Virtual Host with Linux running on bridged network (in case of multiple hosts)
2. Installed and running **docker**
3. Installed **docker-compose**

**sudo pass**

```
a123456
```

## Repository

#### Clone this repository into /workspace

1. Start Terminal
2. Type following

```bash
mkdir -p /workspace
cd /workspace
git clone https://github.com/patresk/node-amazon-dynamo.git
```

## Running application

### ELK stack

#### Configuration location

```bash
/workspace/node-amazon-dynamo/docker/elk/config
```

#### Running

```bash
docker-compose -f /workspace/node-amazon-dynamo/docker/elk/elk.yml up
```

### MASTER NODE: loadbalancer + consul(master) + registrator + application

#### Edit run config for master node

```bash
ifconfig eth0 | grep "inet addr"			#outputs something like: inet addr:192.168.1.10  Bcast:192.168.1.255  Mask:255.255.255.0
subl /workspace/node-amazon-dynamo/docker/master.yml
#Edit line: command: -server -bootstrap -advertise 192.168.1.10
#Use "inet addr" from previous command for -advertise
```

#### Running

```bash
docker-compose -f /workspace/node-amazon-dynamo/docker/master.yml up
```

### Other nodes: consul + registrator + application

#### Edit run config on each other node

```bash
ifconfig eth0 | grep "inet addr"			#outputs something like: inet addr:192.168.1.9  Bcast:192.168.1.255  Mask:255.255.255.0
subl /workspace/node-amazon-dynamo/docker/node.yml
#Edit line: command: -server -advertise 192.168.1.9 -join 192.168.1.10
#Use "inet addr" from previous command for -advertise and "inet addr" of master node for -join
```

#### Running

```bash
docker-compose -f /workspace/node-amazon-dynamo/docker/node.yml up
```

## Implementation

### REST API

Following REST endpoints ensures Dynamo functionality.
Always use `application/json` Content-Type header.

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

#### New node is added to network

Node that is new to the network, follows following steps:

*

#### Incoming request via public api

Node that receives the request via any public endpoint above is becoming the coordinator of the request and is responsible to send response to the user. The coordinator performs following steps:

* Hash the key and get the position of the key in the hashring
* Send requests to the node responsible for the node + to backups node
* When quorum is fullfilled, sends reponse to the user

