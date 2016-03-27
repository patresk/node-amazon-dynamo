
## Dockerized Dynamo Database based on Node.js

**Distributed systems**

**Members:**
- Patrik Gallik
- Viktor Vinczler
- Erik Grman


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

```bash
docker-compose -f /workspace/node-amazon-dynamo/docker/master.yml
```

### Other nodes: consul + registrator + application

```bash
docker-compose -f /workspace/node-amazon-dynamo/docker/node.yml
```