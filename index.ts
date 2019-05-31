import { AWSError, SQS } from "aws-sdk";
import { Poller } from "./poller";

const sqs = new SQS({
  region: process.env.AWS_REGION,
});

function receiveMessage(): Promise<SQS.Types.ReceiveMessageResult> {
  return new Promise((resolve, reject) => {
    sqs.receiveMessage({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 10,
    }, (err: AWSError, data: SQS.Types.ReceiveMessageResult) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

export class MessagePoller {
  private poller: Poller<SQS.Types.ReceiveMessageResult>;

  constructor(private queueUrl: string, options?: any) {
    this.poller = new Poller(receiveMessage.bind({ queueUrl }), options.timeout);
  }

  subscribe(next: (value: string) => void, error?: (error: any) => void) {
    this.poller.subscribe((data: SQS.Types.ReceiveMessageResult) => {
      if (data.Messages) {
        data.Messages.forEach(async message => {
          await next(message.Body);
          await this.deleteMessage(message);
        });
      }
    }, error);
  }

  private deleteMessage(message: SQS.Message): Promise<{}> {
    return new Promise((resolve, reject) => {
      if (message.ReceiptHandle) {
        sqs.deleteMessage({
          QueueUrl: this.queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }, (err: AWSError, data: {}) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      } else {
        reject(new Error('No ReceiptHandle.'));
      }
    });
  }
}
