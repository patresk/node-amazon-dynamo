FROM kibana:latest

RUN apt-get update && apt-get install -y netcat

COPY kibana.sh startKibana.sh
RUN chmod +x startKibana.sh

RUN kibana plugin --install elastic/sense

CMD ["./startKibana.sh"]
